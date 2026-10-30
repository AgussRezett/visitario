import type { Request, Route } from '@playwright/test'
import type { FakeState, Row } from './fake-supabase'

interface Ctx {
  path: string
  req: Request
  route: Route
  state: FakeState
  json: (body: unknown, status?: number) => Promise<void>
  body: () => Row
}

// A 1×1 PNG, for any public picture
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** The public buckets: profile photos and company logos (what is uploaded and removed is kept). */
export async function handleStorage({ path, req, route, state, json, body }: Ctx): Promise<true | undefined> {
  for (const bucket of ['avatars', 'logos'] as const) {
    if (path.includes(`/storage/v1/object/public/${bucket}/`)) {
      await route.fulfill({ contentType: 'image/png', body: PIXEL })
      return true
    }
    if (!path.includes(`/storage/v1/object/${bucket}`)) continue
    const kept = ((state.storage ??= {})[bucket] ??= { uploaded: [], removed: [] })
    if (req.method() === 'DELETE') {
      kept.removed.push(...((body() as { prefixes?: string[] }).prefixes ?? []))
      await json([])
      return true
    }
    const name = path.split(`/storage/v1/object/${bucket}/`)[1] ?? ''
    kept.uploaded.push(name)
    await json({ Key: `${bucket}/${name}`, Id: name })
    return true
  }
  return undefined
}
