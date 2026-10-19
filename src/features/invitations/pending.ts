import { readLocal, writeLocal } from '@/lib/storage'

// The link's token, kept while the invited person signs up, signs in (also with Google)
// or completes their profile, so they come back to the invitation afterwards.
const KEY = 'visitario.invite'

export const pendingInvite = () => readLocal(KEY)
export const rememberInvite = (token: string) => writeLocal(KEY, token)
export const forgetInvite = () => writeLocal(KEY, null)
