// Fixed elements use the layout viewport; the keyboard exposes a smaller,
// independently scrolling visual viewport on mobile browsers.
export function viewportBottomInset(layoutHeight: number, visibleHeight: number, offsetTop: number) {
 return Math.max(0, layoutHeight - visibleHeight - offsetTop)
}

export function trackViewportBottom(update: (inset: number) => void) {
 const viewport = window.visualViewport
 if (!viewport) return () => {}
 let frame = 0
 function measure() {
  update(viewportBottomInset(window.innerHeight, viewport!.height, viewport!.offsetTop))
 }
 function schedule() {
  if (frame) return
  frame = requestAnimationFrame(() => { frame = 0; measure() })
 }
 viewport.addEventListener('resize', schedule)
 viewport.addEventListener('scroll', schedule)
 window.addEventListener('resize', schedule)
 window.addEventListener('scroll', schedule, { passive: true })
 measure()
 return () => {
  cancelAnimationFrame(frame)
  viewport.removeEventListener('resize', schedule)
  viewport.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  window.removeEventListener('scroll', schedule)
 }
}
