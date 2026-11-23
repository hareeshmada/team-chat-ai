import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Workspace } from '../src/models/Workspace.js';
import { createWorkspace } from '../src/services/workspace.service.js';

const ownerId = () => new Types.ObjectId().toString();

/** Returns the given slugs in order (a stand-in for the random generator). */
const slugs = (...values: string[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
};

describe('createWorkspace slug collisions', () => {
  it('retries with a new slug when the random one is already taken', async () => {
    await createWorkspace(ownerId(), { name: 'Acme' }, slugs('acme-aaaaaa'));

    const ws = await createWorkspace(
      ownerId(),
      { name: 'Acme' },
      slugs('acme-aaaaaa', 'acme-bbbbbb'),
    );

    expect(ws.slug).toBe('acme-bbbbbb');
    expect(await Workspace.countDocuments()).toBe(2);
  });

  it('gives up after 3 clashes instead of looping forever', async () => {
    await createWorkspace(ownerId(), { name: 'Acme' }, slugs('acme-aaaaaa'));

    await expect(
      createWorkspace(ownerId(), { name: 'Acme' }, slugs('acme-aaaaaa')),
    ).rejects.toMatchObject({ code: 11000 });
    expect(await Workspace.countDocuments()).toBe(1); // nothing half-created
  });
});
