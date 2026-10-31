import { onBeforeUnmount, watch, type ObjectDirective } from 'vue'

/** Reveal each row once, staggering only the rows that enter the viewport together. */
export function useStaggeredReveal(
  reduceMotion: () => boolean,
): ObjectDirective<HTMLElement> {
  const pending = new Set<HTMLElement>()
  const animations = new Map<HTMLElement, Animation>()
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reduced = () => reduceMotion() || preference.matches
  function finish(element: HTMLElement) {
    pending.delete(element)
    observer?.unobserve(element)
    animations.get(element)?.cancel()
    animations.delete(element)
    delete element.dataset.revealPending
  }
  function reveal(element: HTMLElement, index: number) {
    pending.delete(element)
    observer?.unobserve(element)
    delete element.dataset.revealPending
    if (reduced() || !element.animate) return
    const effect = element.animate(
      [
        { opacity: 0, transform: 'translateY(14px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: 680,
        delay: 80 + Math.min(index * 90, 360),
        easing: 'cubic-bezier(.25,.1,.25,1)',
        fill: 'backwards',
      },
    )
    animations.set(element, effect)
    void effect.finished
      .catch(() => {})
      .finally(() => {
        if (animations.get(element) === effect) animations.delete(element)
      })
  }
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (records) => {
            const visible = records
              .filter(
                (record) =>
                  record.isIntersecting &&
                  pending.has(record.target as HTMLElement),
              )
              .map((record) => record.target as HTMLElement)
              .sort((a, b) =>
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
                  ? -1
                  : 1,
              )
            visible.forEach(reveal)
          },
          { threshold: 0.05, rootMargin: '0px 0px -32px 0px' },
        )
  function showAll() {
    if (!reduced()) return
    for (const element of [...pending, ...animations.keys()]) finish(element)
  }
  const stop = watch(reduceMotion, showAll)
  preference.addEventListener('change', showAll)
  onBeforeUnmount(() => {
    stop()
    preference.removeEventListener('change', showAll)
    observer?.disconnect()
    for (const element of [...pending, ...animations.keys()]) finish(element)
  })
  const focus = (event: FocusEvent) =>
    finish(event.currentTarget as HTMLElement)
  return {
    mounted(element) {
      if (reduced() || !observer || !element.animate) return
      pending.add(element)
      element.dataset.revealPending = ''
      element.addEventListener('focusin', focus)
      observer.observe(element)
    },
    beforeUnmount(element) {
      element.removeEventListener('focusin', focus)
      finish(element)
    },
  }
}
