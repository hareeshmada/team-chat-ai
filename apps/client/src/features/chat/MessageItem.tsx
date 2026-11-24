import type { PublicChannel, PublicMessage, ReactionEmoji } from '@teamchat/shared';
import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { MessageActionsToolbar } from '../../components/ui/MessageActionsToolbar';
import { ReactionPicker } from '../../components/ui/ReactionPicker';
import { cn } from '../../lib/cn';
import { useHighlightStore } from '../../stores/highlight';
import { ActionError, deleteMessage, editMessage, toggleReaction } from './actions';
import { authorColor, memberName } from './format';
import { InlineEditor } from './InlineEditor';
import { MessageActionsSheet } from './MessageActionsSheet';
import { MessageBody } from './MessageBody';
import { MessageRow } from './MessageRow';
import { fromEditable, mentionsIn, toEditable } from './mentionText';
import { Reactions } from './Reactions';
import { useShell } from './shellContext';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

const errorText = (err: unknown) =>
  err instanceof ActionError ? err.message : 'Something went wrong';

/**
 * A saved message with its Day 3 actions: hover toolbar (react; edit/delete on your own),
 * reaction pills, inline edit, delete confirm (Shift+click skips it), long-press sheet on touch.
 */
export function MessageItem({
  message,
  channel,
  author,
  meId,
}: {
  message: PublicMessage;
  channel: PublicChannel;
  author?: { name: string; colorClass: string };
  meId: string;
}) {
  const { members } = useShell();
  const highlighted = useHighlightStore((s) => s.messageId === message.id);
  const isOwn = message.authorId === meId;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const reactRef = useRef<HTMLButtonElement>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);

  const react = (emoji: ReactionEmoji) => {
    setActionError(undefined);
    toggleReaction(message, emoji).catch((err: unknown) => setActionError(errorText(err)));
  };

  const save = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return setEditError('A message can’t be empty. Delete it instead.');
    setSaving(true);
    setEditError(undefined);
    editMessage(message, fromEditable(trimmed, mentionsIn(message.body, members)))
      .then(() => setEditing(false))
      .catch((err: unknown) => setEditError(errorText(err)))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    setDeleting(true);
    setDeleteError(undefined);
    deleteMessage(message)
      .then(() => {
        setConfirming(false);
        // The row's buttons are gone (it's a placeholder now): don't leave focus on <body>.
        setTimeout(() => document.getElementById('composer')?.focus(), 0);
      })
      .catch((err: unknown) => {
        if (confirming) setDeleteError(errorText(err));
        else setActionError(errorText(err));
      })
      .finally(() => setDeleting(false));
  };

  const onDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (e.shiftKey) remove();
    else setConfirming(true);
  };

  // Touch: long-press opens the actions sheet (no hover on phones).
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const rowProps = {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || editing) return;
      const timer = setTimeout(() => {
        press.current = null;
        setSheet(true);
      }, LONG_PRESS_MS);
      press.current = { timer, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE_PX) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    // The browser's own long-press menu would cover ours.
    onContextMenu: (e: MouseEvent) => {
      if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
    },
  };

  if (message.deletedAt) {
    return <MessageRow createdAt={message.createdAt} body={null} deleted />;
  }

  const body = <MessageBody body={message.body} meId={meId} />;

  return (
    <>
      <MessageRow
        createdAt={message.createdAt}
        body={body}
        author={author}
        isOwn={isOwn}
        edited={Boolean(message.editedAt)}
        mentionsMe={message.mentionedUserIds.includes(meId)}
        actionError={actionError}
        rowProps={{ ...rowProps, id: `message-${message.id}` }}
        highlighted={highlighted}
        editor={
          editing ? (
            <InlineEditor
              initial={toEditable(message.body, members)}
              onSave={save}
              onCancel={() => {
                setEditing(false);
                setEditError(undefined);
              }}
              saving={saving}
              error={editError}
            />
          ) : undefined
        }
        reactions={<Reactions message={message} meId={meId} onToggle={react} />}
        toolbar={
          <div className="relative">
            <MessageActionsToolbar
              reactRef={reactRef}
              onReact={() => setPicking((open) => !open)}
              onEdit={isOwn ? () => setEditing(true) : undefined}
              onDelete={isOwn ? onDeleteClick : undefined}
            />
            {picking && (
              <ReactionPicker
                triggerRef={reactRef}
                onPick={react}
                onClose={() => setPicking(false)}
                className="absolute right-0 bottom-full mb-1"
              />
            )}
          </div>
        }
      />

      {confirming && (
        <ConfirmDialog
          title="Delete message?"
          confirmLabel="Delete"
          onConfirm={remove}
          onClose={() => {
            setConfirming(false);
            setDeleteError(undefined);
          }}
          busy={deleting}
          error={deleteError}
        >
          Everyone in #{channel.name} will see “message deleted” in its place.
        </ConfirmDialog>
      )}

      {sheet && (
        <MessageActionsSheet
          preview={
            <>
              {/* Always name the author here, even for a compact (follow-up) row. */}
              <span className={cn('font-semibold', authorColor(message.authorId))}>
                {memberName(members, message.authorId)}
              </span>
              <p className="mt-0.5 line-clamp-3 break-words whitespace-pre-wrap">{body}</p>
            </>
          }
          onReact={react}
          onEdit={isOwn ? () => setEditing(true) : undefined}
          onCopy={() => {
            void navigator.clipboard?.writeText(toEditable(message.body, members));
          }}
          onDelete={isOwn ? () => setConfirming(true) : undefined}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}
