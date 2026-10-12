import { z } from 'zod'

export const passwordSchema = z.string().min(8, 'Usá al menos 8 caracteres').max(72, 'Máximo 72 caracteres')
