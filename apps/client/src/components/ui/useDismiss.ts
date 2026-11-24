import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * For floating layers (menus, pickers): a pointerdown outside the layer AND outside its trigger
 * calls onClose; when the layer unmounts while focus is inside it, focus goes back to the
 * trigger (keyboard users don't get dropped at the top of the page).
 */
export function useDismiss(
  layerRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // Always calls the latest onClose without re-subscribing the document listener.
  const closeFromOutside = useEffectEvent(onClose);

  useEffect(() => {
    const layer = layerRef.current;
    const trigger = triggerRef.current;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (layer?.contains(target) || trigger?.contains(target)) return;
      closeFromOutside();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      if (trigger?.isConnected && layer?.contains(document.activeElement)) trigger.focus();
    };
  }, [layerRef, triggerRef]);
}
