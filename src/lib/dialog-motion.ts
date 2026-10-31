/** Keep the native dialog modal until its exit animation has finished. */
export function createDialogMotion() {
  let animation: Animation | undefined
  let current: HTMLDialogElement | undefined
  let generation = 0
  let closing: Promise<boolean> | undefined
  function reduced() {
    return (
      document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }
  function open(dialog: HTMLDialogElement | null | undefined) {
    if (!dialog || dialog.open) return
    generation++
    animation?.cancel()
    current = dialog
    dialog.dataset.dialogMotion = reduced() ? 'still' : 'opening'
    dialog.showModal()
    if (reduced() || !dialog.animate) return
    animation = dialog.animate(
      [
        { opacity: 0, transform: 'translateY(12px) scale(.96)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    void animation.finished.catch(() => {})
  }
  function close(
    dialog: HTMLDialogElement | null | undefined,
  ): Promise<boolean> {
    if (closing) return closing
    if (!dialog?.open) return Promise.resolve(false)
    const token = ++generation
    const style = getComputedStyle(dialog)
    const start = { opacity: style.opacity, transform: style.transform }
    animation?.cancel()
    dialog.dataset.dialogMotion = reduced() ? 'still' : 'closing'
    if (reduced() || !dialog.animate) {
      dialog.close()
      delete dialog.dataset.dialogMotion
      return Promise.resolve(true)
    }
    animation = dialog.animate(
      [start, { opacity: 0, transform: 'translateY(8px) scale(.97)' }],
      {
        duration: 160,
        easing: 'ease-in',
        fill: 'forwards',
      },
    )
    closing = animation.finished
      .catch(() => {})
      .then(() => {
        if (token !== generation) return false
        dialog.close()
        animation?.cancel()
        animation = undefined
        delete dialog.dataset.dialogMotion
        return true
      })
      .finally(() => {
        closing = undefined
      })
    return closing
  }
  function dispose() {
    generation++
    animation?.cancel()
    animation = undefined
    current?.close()
    if (current) delete current.dataset.dialogMotion
    current = undefined
  }
  return { open, close, dispose }
}
