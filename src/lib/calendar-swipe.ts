// A deliberate drag or a short flick advances one page. A paused short drag returns.
export function swipeDirection(
  distance: number,
  width: number,
  velocity: number,
): number {
  if (width <= 0) return 0
  const dragged = Math.abs(distance) >= Math.min(48, width * 0.15)
  const flicked =
    Math.abs(distance) >= 12 &&
    Math.abs(velocity) >= 0.35 &&
    Math.sign(distance) === Math.sign(velocity)
  return dragged || flicked ? (distance < 0 ? 1 : -1) : 0
}
