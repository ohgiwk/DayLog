// @vitest-environment jsdom
import { createApp, nextTick, ref } from 'vue'
import { expect, it } from 'vitest'
import RichTextEditor from './RichTextEditor.vue'
import { readRichText } from '../lib/rich-text'

it('keeps parent updates and editor input in sync without replacing the edited DOM', async () => {
  const body = ref('最初の本文')
  const readonly = ref(false)
  const root = document.createElement('div')
  const app = createApp({
    components: { RichTextEditor },
    setup: () => ({ body, readonly }),
    template: '<RichTextEditor v-model="body" :readonly="readonly" />',
  })
  app.mount(root)
  try {
    const field = root.querySelector<HTMLElement>('.rich-text-field')!
    expect(field.textContent).toBe('最初の本文')
    body.value = '外部からの更新'
    await nextTick()
    expect(field.textContent).toBe('外部からの更新')
    field.innerHTML = '<b>編集した本文</b>'
    Object.defineProperty(field, 'innerText', {
      configurable: true,
      value: '編集した本文',
    })
    const editedNode = field.firstChild
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(readRichText(body.value)).toEqual({
      html: '<b>編集した本文</b>',
      text: '編集した本文',
    })
    expect(field.firstChild).toBe(editedNode)
    readonly.value = true
    await nextTick()
    field.dispatchEvent(new Event('input', { bubbles: true }))
    expect(readRichText(body.value).text).toBe('編集した本文')
  } finally {
    app.unmount()
  }
})
