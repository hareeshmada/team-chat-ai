import { useEffect, useState } from 'react';
import { addFiles } from './uploads';

const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));

/**
 * Files dragged anywhere over the window → `dragging` (shows the DropZone); dropped → attached
 * to this channel's composer. dragenter/dragleave fire for every child element the pointer
 * crosses, so a counter (not a boolean) tells when the drag really left the window.
 * Dragging text or links inside the page is ignored.
 */
export function useFileDrop(channelId: string): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Without preventDefault on dragover the browser won't allow a drop (it opens the file instead).
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      addFiles(channelId, Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [channelId]);

  return dragging;
}
