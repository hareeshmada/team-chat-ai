import { MESSAGE_BODY_MAX } from '@teamchat/shared';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';

const MAX_HEIGHT_PX = 200;

/**
 * The message turns into an editor in place (DESIGN §8 InlineEditor). Enter saves,
 * Shift+Enter adds a line, Esc cancels. Starts with the cursor at the end of the text.
 */
export function InlineEditor({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  saving: boolean;
  error?: string;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const errorId = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = () => {
    if (!saving) onSave(text);
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Edit message
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={2}
        value={text}
        maxLength={MESSAGE_BODY_MAX}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
        }}
        className="resize-none rounded-md border border-accent bg-field px-2.5 py-2 leading-normal ring-[3px] ring-focus-ring outline-none"
      />
      {error && (
        <span id={errorId} role="alert" className="font-mono text-[11px] text-danger">
          {error}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 font-mono text-[11px] text-muted">esc cancel · ↵ save</span>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}
