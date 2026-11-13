export function bindTouchOrder(grid: HTMLElement, onMove: (from: number, to: number) => void) {
  let gesture: { id: number; from: number; x: number; y: number; active: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function reset() { clearTimeout(timer); gesture = null; }
  function cardAt(target: EventTarget | null) {
    const card = target instanceof Element ? target.closest<HTMLElement>('[data-order-index]') : null;
    return card && grid.contains(card) ? card : null;
  }
  function start(event: TouchEvent) {
    reset();
    const card = cardAt(event.target);
    if (event.touches.length !== 1 || !card) return;
    const touch = event.touches[0];
    gesture = { id: touch.identifier, from: Number(card.dataset.orderIndex), x: touch.clientX, y: touch.clientY, active: false };
    // Let an ordinary swipe scroll; only a held card starts a reorder.
    timer = setTimeout(() => { if (gesture) gesture.active = true; }, 300);
  }
  function move(event: TouchEvent) {
    if (!gesture) return;
    const touch = event.touches[0];
    if (event.touches.length !== 1 || touch.identifier !== gesture.id) return reset();
    if (!gesture.active) {
      if (Math.hypot(touch.clientX - gesture.x, touch.clientY - gesture.y) > 8) reset();
      return;
    }
    if (!event.cancelable) return reset();
    event.preventDefault();
  }
  function end(event: TouchEvent) {
    const current = gesture;
    reset();
    const touch = Array.from(event.changedTouches).find(item => item.identifier === current?.id);
    if (!current?.active || !touch || event.touches.length) return;
    event.preventDefault();
    const card = cardAt(grid.ownerDocument.elementFromPoint(touch.clientX, touch.clientY));
    if (card) onMove(current.from, Number(card.dataset.orderIndex));
  }
  grid.addEventListener('touchstart', start, { passive: true });
  grid.addEventListener('touchmove', move, { passive: false });
  grid.addEventListener('touchend', end, { passive: false });
  grid.addEventListener('touchcancel', reset);
  return () => {
    reset();
    grid.removeEventListener('touchstart', start);
    grid.removeEventListener('touchmove', move);
    grid.removeEventListener('touchend', end);
    grid.removeEventListener('touchcancel', reset);
  };
}
