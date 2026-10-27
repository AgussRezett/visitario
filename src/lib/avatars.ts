import { env } from './env'

/** Profile photos live in the public "avatars" bucket; their names never repeat, so they cache forever. */
export const avatarUrl = (path: string | null | undefined) => (path ? `${env.supabaseUrl}/storage/v1/object/public/avatars/${path}` : null)
