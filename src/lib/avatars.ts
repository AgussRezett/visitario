import { env } from './env'

/** Profile photos live in the public "avatars" bucket; their names never repeat, so they cache forever. */
export const avatarUrl = (path: string | null | undefined) => (path ? `${env.supabaseUrl}/storage/v1/object/public/avatars/${path}` : null)

/** Company logos live in the public "logos" bucket, under the company's folder; names never repeat. */
export const logoUrl = (path: string | null | undefined) => (path ? `${env.supabaseUrl}/storage/v1/object/public/logos/${path}` : null)
