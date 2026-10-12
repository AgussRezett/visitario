// Maps database error messages (English, stable) to Spanish UI copy.
const MESSAGES: Array<[RegExp, string]> = [
  [/already has an account/i, 'Ese DNI ya tiene una cuenta. Entrá con ese usuario o pedile ayuda a tu empresa.'],
  [/Verify the phone/i, 'Tu empresa ya cargó este DNI con otro celular. Para vincularlo hay que verificar ese número: pedile a tu admin que lo revise.'],
  [/Identity already completed/i, 'Ya completaste tus datos.'],
  [/person_private_dni_check|dni/i, 'Revisá el DNI: son 7 u 8 números.'],
  [/phone_check/i, 'Revisá el celular.'],
]

export function identityErrorMessage(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? ''
  for (const [re, text] of MESSAGES) if (re.test(msg)) return text
  return 'No pudimos guardar tus datos. Probá de nuevo.'
}
