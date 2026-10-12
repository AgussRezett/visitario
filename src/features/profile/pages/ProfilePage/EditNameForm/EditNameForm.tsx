import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import styles from './EditNameForm.module.scss'

const schema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80) })
type Values = z.infer<typeof schema>

export function EditNameForm({ personId, defaults, onDone }: { personId: string; defaults: Values; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const onSubmit = handleSubmit(async (v) => {
    const { error } = await supabase.from('person').update({ first_name: v.firstName, last_name: v.lastName }).eq('id', personId)
    if (!error) {
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      onDone()
    }
  })
  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <div className={styles.fields}>
        <Field label="Nombre" error={formState.errors.firstName ? 'Ingresá tu nombre' : undefined} {...register('firstName')} />
        <Field label="Apellido" error={formState.errors.lastName ? 'Ingresá tu apellido' : undefined} {...register('lastName')} />
      </div>
      <div className={styles.buttons}>
        <Button type="submit" size="md" loading={formState.isSubmitting}>Guardar</Button>
        <Button size="md" variant="secondary" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  )
}
