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

/** The profile photos' public bucket: what is uploaded and removed is kept. */
export async function handleStorage({ path, req, route, state, json, body }: Ctx): Promise<true | undefined> {
  if (path.includes('/storage/v1/object/public/avatars/')) {
    await route.fulfill({ contentType: 'image/png', body: PIXEL })
    return true
  }
  if (!path.includes('/storage/v1/object/avatars')) return undefined
  if (req.method() === 'DELETE') {
    ;(state.avatarsRemoved ??= []).push(...((body() as { prefixes?: string[] }).prefixes ?? []))
    await json([])
    return true
  }
  const name = path.split('/storage/v1/object/avatars/')[1] ?? ''
  ;(state.avatarsUploaded ??= []).push(name)
  await json({ Key: `avatars/${name}`, Id: name })
  return true
}
