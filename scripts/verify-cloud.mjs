// Run only with two disposable, email-confirmed test accounts. Never use real diaries.
// DAYLOG_TEST_ACCOUNTS points to [{id,email,password}, ...] outside the repository.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
const accounts = JSON.parse(readFileSync(process.env.DAYLOG_TEST_ACCOUNTS, 'utf8'))
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const devices = [client(), client(), client()]
const photoId = randomUUID(), photoPath = `${accounts[0].id}/${photoId}`
const date = '2000-01-01', v1 = randomUUID(), v2 = randomUUID()
async function ok(promise) { const result = await promise; if (result.error) throw result.error; return result.data }
try {
 for (let i = 0; i < devices.length; i++) {
  const account = accounts[i === 2 ? 1 : 0]
  const data = await ok(devices[i].auth.signInWithPassword({ email: account.email, password: account.password }))
  assert.equal(data.user.id, account.id)
 }
 console.log('PASS: two independent sessions for one account and a separate account')
 const diary = { id: randomUUID(), date, mood: 4, condition: 3, answers: { mood: '4' }, tags: [], guess: '同期テスト', body: '端末A', tomorrow: '', imageIds: [photoId], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
 const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64')
 await ok(devices[0].storage.from('daylog-photos').upload(photoPath, png, { contentType: 'image/png' }))
 await ok(devices[0].rpc('daylog_write_entry', { p_date: date, p_entry: diary, p_expected: null, p_version: v1 }))
 const rows = await ok(devices[1].from('daylog_entries').select('*').eq('date', date))
 assert.equal(rows[0].entry.body, '端末A')
 const blob = await ok(devices[1].storage.from('daylog-photos').download(photoPath))
 assert.equal(blob.size, png.length)
 console.log('PASS: diary and private photo readable on the second device')
 assert.deepEqual(await ok(devices[2].from('daylog_entries').select('*').eq('user_id', accounts[0].id)), [])
 assert.ok((await devices[2].storage.from('daylog-photos').download(photoPath)).error)
 const forbiddenWrite = await devices[2].from('daylog_entries').insert({ user_id: accounts[0].id, date: '2000-01-02', entry: null, version: randomUUID() })
 assert.ok(forbiddenWrite.error)
 console.log('PASS: another account cannot read photos/diaries or write another owner’s rows')
 await ok(devices[1].rpc('daylog_write_entry', { p_date: date, p_entry: { ...diary, body: '端末B' }, p_expected: v1, p_version: v2 }))
 const conflict = await devices[0].rpc('daylog_write_entry', { p_date: date, p_entry: diary, p_expected: v1, p_version: randomUUID() })
 assert.ok(conflict.error?.message.includes('sync_conflict'))
 console.log('PASS: concurrent outdated edit is rejected without overwriting the newer diary')
 await ok(devices[1].rpc('daylog_write_entry', { p_date: date, p_entry: null, p_expected: v2, p_version: randomUUID() }))
 const deleted = await ok(devices[0].from('daylog_entries').select('entry').eq('date', date).single())
 assert.equal(deleted.entry, null)
 console.log('PASS: deletion reaches the other device as a tombstone')
} finally {
 const cleanup = await devices[0].storage.from('daylog-photos').remove([photoPath])
 if (cleanup.error) console.error('Photo cleanup requires attention:', cleanup.error.message)
 await Promise.all(devices.map(device => device.auth.signOut()))
}
