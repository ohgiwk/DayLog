import { nextTick } from 'vue'

// Match the 260 ms opacity fade used by routed pages without unmounting the editor.
export async function fadeView(element: HTMLElement | undefined, change: () => void | Promise<void>) {
 const reduced = document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
 if (!element || reduced) { await change(); return }
 const pointerEvents = element.style.pointerEvents
 element.style.pointerEvents = 'none'
 let animation: Animation | undefined
 try {
  animation = element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease', fill: 'forwards' })
  await animation.finished
  if (!element.isConnected) return
  await change()
  await nextTick()
  animation.cancel()
  animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease' })
  await animation.finished
 } finally {
  animation?.cancel()
  element.style.pointerEvents = pointerEvents
 }
}
