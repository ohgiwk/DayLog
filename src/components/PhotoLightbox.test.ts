// @vitest-environment jsdom
import { createApp } from 'vue'
import { expect, it, vi } from 'vitest'
import PhotoLightbox from './PhotoLightbox.vue'

it('closes on a backdrop tap, while ignoring image taps and the click after a swipe', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const originals = ['showModal', 'close'].map((key) =>
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key),
  )
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    },
  })
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scroll,
  })
  const root = document.createElement('div')
  document.body.append(root)
  const onClose = vi.fn()
  const app = createApp(PhotoLightbox, {
    photos: [{ id: 'photo', url: 'data:image/png;base64,YQ==' }],
    initialId: 'photo',
    onClose,
  })
  app.mount(root)
  try {
    const dialog = document.querySelector('dialog')!
    const stage = dialog.querySelector('.photo-viewer-stage')!
    const image = dialog.querySelector('img')!
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 300,
      bottom: 300,
    } as DOMRect)
    image.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 150 }),
    )
    expect(onClose).not.toHaveBeenCalled()
    stage.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 200,
        clientY: 200,
      }),
    )
    stage.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 30,
        clientY: 30,
      }),
    )
    stage.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, clientX: 30, clientY: 30 }),
    )
    stage.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }),
    )
    expect(onClose).not.toHaveBeenCalled()
    stage.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 30,
        clientY: 30,
      }),
    )
    stage.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, clientX: 30, clientY: 30 }),
    )
    stage.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30 }),
    )
    expect(onClose).toHaveBeenCalledOnce()
    expect(dialog.open).toBe(false)
  } finally {
    app.unmount()
    root.remove()
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo
    ;['showModal', 'close'].forEach((key, i) => {
      const descriptor = originals[i]
      if (descriptor)
        Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
    })
    vi.unstubAllGlobals()
  }
})
