import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyMemoSnapshot, type MemoSnapshot } from './memo-sync-model'
import type { MemoLibrary } from './memo-repository'
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  head: vi.fn(),
  payload: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  owner: 'a',
  snapshot: null as MemoSnapshot | null,
}))
vi.mock('./supabase', () => ({
  supabase: {
    rpc: mock.rpc,
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          maybeSingle: mock.head,
          single: mock.payload,
        }
        return query
      },
    }),
  },
}))
vi.mock('./memo-repository', () => ({
  memoOwner: () => mock.owner,
  onMemoChange: vi.fn(),
  readMemoSnapshot: mock.read,
  updateMemoSnapshot: mock.write,
}))
const library = (title: string): MemoLibrary => ({
  folders: [{ id: 'f', name: 'フォルダ' }],
  notes: [{ id: 'n', folderId: 'f', title, html: '', updatedAt: '' }],
})
beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  mock.owner = 'a'
  mock.snapshot = {
    ...emptyMemoSnapshot(),
    library: library('この端末'),
    pending: 'local',
  }
  mock.read.mockImplementation(async () => structuredClone(mock.snapshot))
  mock.write.mockImplementation(
    async (_id: string, change: (snapshot: MemoSnapshot) => MemoSnapshot) => {
      mock.snapshot = change(structuredClone(mock.snapshot!))
      return structuredClone(mock.snapshot)
    },
  )
  mock.rpc.mockResolvedValue({ error: null })
  mock.head.mockResolvedValue({ data: { version: 'local' }, error: null })
  mock.payload.mockResolvedValue({
    data: { library: library('別端末'), version: 'remote' },
    error: null,
  })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('memo sync transport', () => {
  it('keeps offline edits queued and performs no network request', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { syncMemos, memoSyncState } = await import('./memo-sync')
    expect(await syncMemos()).toBe(false)
    expect(mock.rpc).not.toHaveBeenCalled()
    expect(mock.snapshot!.pending).toBe('local')
    expect(memoSyncState.error).toContain('端末に保存')
  })
  it('acknowledges successful uploads and avoids downloading unchanged photo payloads', async () => {
    const { syncMemos, memoSyncState } = await import('./memo-sync')
    expect(await syncMemos()).toBe(true)
    expect(mock.rpc).toHaveBeenCalledWith('daylog_write_memos', {
      p_library: library('この端末'),
      p_expected: null,
      p_version: 'local',
    })
    expect(mock.snapshot!.pending).toBeNull()
    expect(mock.payload).not.toHaveBeenCalled()
    expect(memoSyncState.pending).toBe(0)
    expect(memoSyncState.lastSynced).not.toBe('')
  })
  it('keeps edits made during an upload queued and leaves the editor intact', async () => {
    mock.rpc.mockImplementationOnce(async () => {
      mock.snapshot = {
        ...mock.snapshot!,
        library: library('送信中に追記'),
        pending: 'new-edit',
      }
      return { error: null }
    })
    const { syncMemos, setMemoEditingCheck } = await import('./memo-sync')
    setMemoEditingCheck(() => true)
    expect(await syncMemos()).toBe(false)
    expect(mock.snapshot!).toMatchObject({
      library: library('送信中に追記'),
      pending: 'new-edit',
      version: 'local',
    })
    expect(mock.head).not.toHaveBeenCalled()
  })
  it('keeps both sides when the remote revision conflicts with the same local note', async () => {
    mock.snapshot = {
      ...mock.snapshot!,
      base: library('元の内容'),
      version: 'base',
    }
    mock.rpc.mockResolvedValue({ error: { message: 'sync_conflict' } })
    mock.head.mockResolvedValue({ data: { version: 'remote' }, error: null })
    const { syncMemos, memoSyncState } = await import('./memo-sync')
    expect(await syncMemos()).toBe(false)
    expect(mock.snapshot!.library).toEqual(library('この端末'))
    expect(mock.snapshot!.conflict?.library).toEqual(library('別端末'))
    expect(memoSyncState.conflict).not.toBeNull()
  })
  it('does not replace content when an editor opens while the remote payload is in flight', async () => {
    mock.snapshot!.pending = null
    mock.head.mockResolvedValue({ data: { version: 'remote' }, error: null })
    let editing = false
    mock.payload.mockImplementationOnce(async () => {
      editing = true
      return {
        data: { library: library('別端末'), version: 'remote' },
        error: null,
      }
    })
    const { syncMemos, setMemoEditingCheck } = await import('./memo-sync')
    setMemoEditingCheck(() => editing)
    expect(await syncMemos()).toBe(false)
    expect(mock.snapshot!.library).toEqual(library('この端末'))
  })
  it('ignores an upload response after switching to another account', async () => {
    mock.rpc.mockImplementationOnce(async () => {
      mock.owner = 'b'
      mock.snapshot = emptyMemoSnapshot()
      return { error: null }
    })
    const { syncMemos } = await import('./memo-sync')
    expect(await syncMemos()).toBe(false)
    expect(mock.write).not.toHaveBeenCalled()
    expect(mock.snapshot).toEqual(emptyMemoSnapshot())
  })
  it('keeps a failed upload durable and allows retry', async () => {
    mock.rpc.mockResolvedValueOnce({ error: new Error('network') })
    const { syncMemos, memoSyncState } = await import('./memo-sync')
    expect(await syncMemos()).toBe(false)
    expect(mock.snapshot!.pending).toBe('local')
    expect(memoSyncState.error).toContain('同期できませんでした')
    expect(await syncMemos()).toBe(true)
    expect(memoSyncState.error).toBe('')
  })
  it('does not start a second concurrent upload', async () => {
    let finish!: (value: { error: null }) => void
    mock.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { syncMemos } = await import('./memo-sync')
    const first = syncMemos()
    await vi.waitFor(() => expect(mock.rpc).toHaveBeenCalledOnce())
    expect(await syncMemos()).toBe(false)
    finish({ error: null })
    expect(await first).toBe(true)
    expect(mock.rpc).toHaveBeenCalledOnce()
  })
  it('uses the account lock to serialize writes across browser tabs', async () => {
    const lock = vi.fn(async (_name: string, run: () => Promise<boolean>) =>
      run(),
    )
    vi.stubGlobal('navigator', { onLine: true, locks: { request: lock } })
    const { syncMemos } = await import('./memo-sync')
    expect(await syncMemos()).toBe(true)
    expect(lock).toHaveBeenCalledWith(
      'daylog-memo-sync:a',
      expect.any(Function),
    )
  })
})
