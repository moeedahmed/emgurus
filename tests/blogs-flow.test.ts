/*
  Integration test for blogs flow using direct fetch to Supabase Edge Function.
  Requires SUPABASE_TEST_JWT (a valid user JWT with admin/reviewer rights) in env to run.
  If not provided, tests are skipped.
*/
import { describe, it, expect, beforeAll, vi } from 'vitest'

const SUPABASE_URL = 'https://cgtvvpzrzwyvsbavboxa.supabase.co'
const BASE = `${SUPABASE_URL}/functions/v1/blogs-api`
const TOKEN = process.env.SUPABASE_TEST_JWT

async function req(method: string, path: string, body?: any, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: any
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { ok: res.ok, status: res.status, json }
}

const skip = !TOKEN

describe.skipIf(skip)('Blogs flow (create → submit → publish)', () => {
  let created: { id: string; slug: string }

  it('creates a draft', async () => {
    const title = `Test Post ${Date.now()}`
    const r = await req('POST', '/api/blogs', { title, content_md: '# Hello' }, TOKEN)
    expect(r.ok, `Create failed: ${r.status} ${JSON.stringify(r.json)}`).toBe(true)
    expect(r.json).toHaveProperty('id')
    expect(r.json).toHaveProperty('slug')
    created = r.json
  })

  it('submits the draft for review', async () => {
    const r = await req('POST', `/api/blogs/${created.id}/submit`, undefined, TOKEN)
    expect(r.ok, `Submit failed: ${r.status} ${JSON.stringify(r.json)}`).toBe(true)
  })

  it('publishes the post', async () => {
    const r = await req('POST', `/api/blogs/${created.id}/publish`, undefined, TOKEN)
    expect(r.ok, `Publish failed: ${r.status} ${JSON.stringify(r.json)}`).toBe(true)
  })

  it('verifies the post is visible in published list', async () => {
    const r = await req('GET', `/api/blogs?status=published&page_size=5`)
    expect(r.ok, `List failed: ${r.status} ${JSON.stringify(r.json)}`).toBe(true)
    expect(Array.isArray(r.json.items)).toBe(true)
    expect(r.json.items.some((p: any) => p.id === created.id)).toBe(true)
  })
})

// If skipped, give a helpful message in test output
if (skip) {
  describe('Blogs flow (skipped)', () => {
    it('skips because SUPABASE_TEST_JWT is not set', () => {
      expect(true).toBe(true)
    })
  })
}
