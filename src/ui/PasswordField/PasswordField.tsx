import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field, type FieldProps } from '@/ui/Field'
import styles from './PasswordField.module.scss'

/** Password input with a button to show or hide what was typed. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type' | 'action'>>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <Field
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      action={
        <button
          type="button"
          className={styles.toggle}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      }
    />
  )
})
