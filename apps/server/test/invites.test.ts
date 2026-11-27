import {
  inviteListResponseSchema,
  invitePreviewResponseSchema,
  publicInviteSchema,
} from '@teamchat/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { inviteEmail } from '../src/emails/inviteEmail.js';
import { markInviteEmailFailed, processInviteEmail } from '../src/jobs/inviteEmail.job.js';
import { enqueueInviteEmail, type InviteEmailJobData } from '../src/jobs/queues.js';
import type { MailMessage } from '../src/lib/mailer.js';
import { Invite } from '../src/models/Invite.js';
import { Membership } from '../src/models/Membership.js';
import { inviteToken } from '../src/services/invite.service.js';
import { registerUser } from './helpers/auth.js';
import { auth, createWorkspace, invite, makeUser } from './helpers/workspace.js';

const app = createApp();
const enqueue = vi.mocked(enqueueInviteEmail);

/** The job the API queued last (the nonce lets the test build the link token, like the worker). */
const lastJob = (): InviteEmailJobData => enqueue.mock.calls.at(-1)![0];
const lastToken = () => inviteToken(lastJob().nonce);

async function setup() {
  const asha = await makeUser(app, 'Asha');
  const acme = await createWorkspace(app, asha.token, 'Acme Studio');
  return { asha, acme };
}

beforeEach(() => enqueue.mockClear());

describe('POST /api/workspaces/:id/members with an email that has no account', () => {
  it('creates a pending invite and queues one invite-email job', async () => {
    const { asha, acme } = await setup();

    const res = await invite(app, asha.token, acme.id, 'Meera@Gmail.com', 'admin');
    expect(res.status).toBe(201);
    const inv = publicInviteSchema.parse(res.body.invite);
    expect(inv).toMatchObject({
      workspaceId: acme.id,
      email: 'meera@gmail.com',
      role: 'admin',
      status: 'pending',
      emailStatus: 'sending',
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(lastJob().inviteId).toBe(inv.id);

    // The token itself is never stored, only its hash.
    const saved = await Invite.findById(inv.id).lean();
    expect(JSON.stringify(saved)).not.toContain(lastToken());
  });

  it('inviting the same email again renews the invite (new link, old one dies)', async () => {
    const { asha, acme } = await setup();
    const first = await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const oldToken = lastToken();

    const second = await invite(app, asha.token, acme.id, 'meera@gmail.com');
    expect(second.status).toBe(201);
    expect(second.body.invite.id).toBe(first.body.invite.id);
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(await Invite.countDocuments()).toBe(1);

    expect((await request(app).get(`/api/invites/${oldToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/invites/${lastToken()}`)).status).toBe(200);
  });

  it('marks the email failed when the queue (Redis) is unreachable', async () => {
    const { asha, acme } = await setup();
    enqueue.mockRejectedValueOnce(new Error('queue unavailable'));

    const res = await invite(app, asha.token, acme.id, 'meera@gmail.com');
    expect(res.status).toBe(201);
    expect(res.body.invite.emailStatus).toBe('failed');
  });

  it('still adds an existing account directly (no invite, no job)', async () => {
    const { asha, acme } = await setup();
    const ravi = await makeUser(app, 'Ravi');

    const res = await invite(app, asha.token, acme.id, ravi.email);
    expect(res.status).toBe(201);
    expect(res.body.member.userId).toBe(ravi.id);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('GET /api/workspaces/:id/invites', () => {
  it('lists invites newest first for admins; members get 403', async () => {
    const { asha, acme } = await setup();
    const ravi = await makeUser(app, 'Ravi');
    await invite(app, asha.token, acme.id, ravi.email); // member
    await invite(app, asha.token, acme.id, 'one@example.com');
    await invite(app, asha.token, acme.id, 'two@example.com');

    const res = await request(app).get(`/api/workspaces/${acme.id}/invites`).set(auth(asha.token));
    expect(res.status).toBe(200);
    const { invites } = inviteListResponseSchema.parse(res.body);
    expect(invites.map((i) => i.email)).toEqual(['two@example.com', 'one@example.com']);

    const asMember = await request(app)
      .get(`/api/workspaces/${acme.id}/invites`)
      .set(auth(ravi.token));
    expect(asMember.status).toBe(403);
  });

  it('leaves out expired pending invites', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'old@example.com');
    await Invite.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).get(`/api/workspaces/${acme.id}/invites`).set(auth(asha.token));
    expect(res.body.invites).toEqual([]);
  });
});

describe('GET /api/invites/:token (public)', () => {
  it('returns what the sign-up banner shows', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');

    const res = await request(app).get(`/api/invites/${lastToken()}`);
    expect(res.status).toBe(200);
    expect(invitePreviewResponseSchema.parse(res.body).invite).toEqual({
      email: 'meera@gmail.com',
      workspaceId: acme.id,
      workspaceName: 'Acme Studio',
      invitedByName: 'Asha',
      role: 'member',
    });
  });

  it('400 for a malformed token, 404 for an unknown or expired one', async () => {
    const { asha, acme } = await setup();
    expect((await request(app).get('/api/invites/not-a-token')).status).toBe(400);
    expect((await request(app).get(`/api/invites/${inviteToken('nope')}`)).status).toBe(404);

    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    await Invite.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const expired = await request(app).get(`/api/invites/${lastToken()}`);
    expect(expired.status).toBe(404);
    expect(expired.body.error.code).toBe('INVITE_NOT_FOUND');
  });
});

describe('accepting an invite', () => {
  it('sign-up from the link joins the workspace and marks the invite accepted', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com', 'admin');

    const { res } = await registerUser(app, {
      name: 'Meera',
      email: 'meera@gmail.com',
      inviteToken: lastToken(),
    });
    expect(res.status).toBe(201);

    const list = await request(app).get('/api/workspaces').set(auth(res.body.accessToken));
    expect(list.body.workspaces).toEqual([expect.objectContaining({ id: acme.id, role: 'admin' })]);
    const saved = await Invite.findOne().lean();
    expect(saved).toMatchObject({ status: 'accepted' });

    // A used link no longer previews.
    expect((await request(app).get(`/api/invites/${lastToken()}`)).status).toBe(404);
  });

  it('signing up with the same email WITHOUT the link does not join (email is not proof)', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');

    const { res } = await registerUser(app, { name: 'Meera', email: 'meera@gmail.com' });
    expect(res.status).toBe(201);
    expect(await Membership.countDocuments({ workspaceId: acme.id })).toBe(1);
    expect((await Invite.findOne().lean())?.status).toBe('pending');
  });

  it('a link for another email never blocks sign-up, and joins nothing', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');

    const { res } = await registerUser(app, {
      name: 'Mallory',
      email: 'mallory@example.com',
      inviteToken: lastToken(),
    });
    expect(res.status).toBe(201);
    expect(await Membership.countDocuments({ workspaceId: acme.id })).toBe(1);
  });

  it('POST /api/invites/:token/accept while signed in (right email only, repeatable)', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const token = lastToken();
    // Meera signed up without the link, then opens it.
    const meera = await registerUser(app, { name: 'Meera', email: 'meera@gmail.com' });
    const ravi = await makeUser(app, 'Ravi');

    const wrong = await request(app).post(`/api/invites/${token}/accept`).set(auth(ravi.token));
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('INVITE_EMAIL_MISMATCH');

    const ok = await request(app).post(`/api/invites/${token}/accept`).set(auth(meera.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ workspaceId: acme.id });

    const again = await request(app)
      .post(`/api/invites/${token}/accept`)
      .set(auth(meera.accessToken));
    expect(again.status).toBe(200);
    expect(await Membership.countDocuments({ workspaceId: acme.id })).toBe(2);

    // After it's used, nobody else can use it.
    expect(
      (await request(app).post(`/api/invites/${token}/accept`).set(auth(ravi.token))).status,
    ).toBe(404);
    expect((await request(app).post(`/api/invites/${token}/accept`)).status).toBe(401);
  });
});

describe('invite-email job', () => {
  let sent: MailMessage[];
  const sendMail = async (m: MailMessage) => {
    sent.push(m);
  };
  const publish = vi.fn(async () => {});

  beforeEach(() => {
    sent = [];
    publish.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends the email with the link, marks it sent and tells the API', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const job = lastJob();

    expect(await processInviteEmail(job, { sendMail, publish })).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('meera@gmail.com');
    expect(sent[0]!.subject).toBe('Asha invited you to join Acme Studio on TeamChat AI');
    expect(sent[0]!.html).toContain(`/invite/${inviteToken(job.nonce)}`);
    expect(sent[0]!.text).toContain(`/invite/${inviteToken(job.nonce)}`);
    expect((await Invite.findById(job.inviteId))?.emailStatus).toBe('sent');
    expect(publish).toHaveBeenCalledWith({ type: 'invite:updated', inviteId: job.inviteId });
  });

  it('is idempotent: running it again sends nothing', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const job = lastJob();

    await processInviteEmail(job, { sendMail, publish });
    expect(await processInviteEmail(job, { sendMail, publish })).toBe('already-sent');
    expect(sent).toHaveLength(1);
  });

  it('skips a job for an older version of the invite (re-invited meanwhile)', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const oldJob = lastJob();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');

    expect(await processInviteEmail(oldJob, { sendMail, publish })).toBe('stale');
    expect(sent).toHaveLength(0);
  });

  it('a failing SMTP send throws (BullMQ retries); after the last try it is marked failed', async () => {
    const { asha, acme } = await setup();
    await invite(app, asha.token, acme.id, 'meera@gmail.com');
    const job = lastJob();
    const broken = async () => {
      throw new Error('ECONNREFUSED');
    };

    await expect(processInviteEmail(job, { sendMail: broken, publish })).rejects.toThrow();
    expect((await Invite.findById(job.inviteId))?.emailStatus).toBe('sending');

    await markInviteEmailFailed(job, publish);
    expect((await Invite.findById(job.inviteId))?.emailStatus).toBe('failed');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('escapes names in the HTML', () => {
    const mail = inviteEmail({
      to: 'a@b.co',
      inviterName: '<img src=x onerror=alert(1)>',
      workspaceName: 'A & B',
      role: 'member',
      link: 'http://localhost:5173/invite/x',
    });
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('A &amp; B');
  });
});
