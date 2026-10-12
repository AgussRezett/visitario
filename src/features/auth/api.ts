import { supabase } from '@/lib/supabase'
import { normalizeDni } from '@/domain/identity'
import { clearLocalData } from '@/features/sync/db'
import { forgetAll } from '@/features/sync/outbox'

export class AuthError extends Error {}

/** Signs in with DNI or email. DNI goes through an Edge Function that never reveals whether it exists. */
export async function signIn(identifier: string, password: string) {
  const id = identifier.trim()
  if (id.includes('@')) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password })
    if (error) throw new AuthError('El email o la contraseña no coinciden.')
    return
  }
  const { data, error } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>('sign-in-with-dni', {
    body: { dni: normalizeDni(id), password },
  })
  if (error || !data) throw new AuthError('El DNI o la contraseña no coinciden.')
  const { error: sessionError } = await supabase.auth.setSession(data)
  if (sessionError) throw new AuthError('No pudimos iniciar la sesión. Probá de nuevo.')
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/onboarding` },
  })
  if (error) throw new AuthError(error.message.includes('already') ? 'Ese email ya tiene cuenta. Entrá con tu contraseña.' : 'No pudimos crear la cuenta.')
  return { needsEmailConfirmation: !data.session }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })
  if (error) throw new AuthError('No pudimos abrir Google. Probá de nuevo.')
}

export async function sendPasswordReset(email: string) {
  await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/profile` })
}

export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new AuthError('No pudimos guardar la contraseña.')
}

export async function signOut() {
  await supabase.auth.signOut()
  forgetAll()
  await clearLocalData() // a shared phone must not show the previous person's day
}
