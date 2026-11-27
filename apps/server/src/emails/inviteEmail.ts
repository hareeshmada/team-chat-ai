import type { MailMessage } from '../lib/mailer.js';

/**
 * The invite email (DESIGN "Invite email template", reference day5-invites-email.html §02).
 * Email clients ignore <style> blocks and CSS variables, so this is a table layout with inline
 * styles and literal colours copied from the LIGHT theme tokens; system fonts only.
 * Every value that came from a user (names, email) is HTML-escaped.
 */

export interface InviteEmailInput {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: 'admin' | 'member';
  link: string;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export function inviteEmail(input: InviteEmailInput): MailMessage {
  const inviter = escapeHtml(input.inviterName);
  const workspace = escapeHtml(input.workspaceName);
  const to = escapeHtml(input.to);
  const link = escapeHtml(input.link);
  const subject = `${input.inviterName} invited you to join ${input.workspaceName} on TeamChat AI`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F8FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FA;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
  <tr><td style="padding:0 0 20px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;background:#A3E635;border-radius:6px;color:#0B0D10;font-family:${MONO};font-size:12px;font-weight:600;">tc</td>
      <td style="padding-left:8px;font-family:${MONO};font-size:14px;font-weight:600;color:#111418;">teamchat-ai</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #E1E4E8;border-radius:10px;padding:32px;font-family:${SANS};color:#111418;">
    <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;">${inviter} invited you to join ${workspace}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#3A424D;">${workspace} uses TeamChat AI for real-time channels, live notifications and an AI assistant that keeps the team in sync. You’ll join as ${input.role === 'admin' ? 'an' : 'a'} <strong>${input.role}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr>
      <td align="center" style="background:#65A30D;border-radius:6px;">
        <a href="${link}" style="display:inline-block;padding:0 20px;line-height:44px;height:44px;font-family:${SANS};font-size:15px;font-weight:600;color:#0B0D10;text-decoration:none;">Join ${workspace}</a>
      </td>
    </tr></table>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#5B6470;">Or paste this link into your browser:<br><span style="font-family:${MONO};font-size:12px;color:#4D7C0F;word-break:break-all;">${link}</span></p>
  </td></tr>
  <tr><td align="center" style="padding:20px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:#5B6470;">This invite was sent to ${to}. If you weren’t expecting it, you can ignore this email.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `${input.inviterName} invited you to join ${input.workspaceName} on TeamChat AI.`,
    `You'll join as ${input.role === 'admin' ? 'an' : 'a'} ${input.role}.`,
    '',
    `Join: ${input.link}`,
    '',
    `This invite was sent to ${input.to}. If you weren't expecting it, you can ignore this email.`,
  ].join('\n');

  return { to: input.to, subject, html, text };
}
