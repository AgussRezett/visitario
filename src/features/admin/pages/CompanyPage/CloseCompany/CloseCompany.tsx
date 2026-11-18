import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { closePreviewQuery, useCloseCompany } from '@/features/admin/api/closure'
import styles from './CloseCompany.module.scss'

interface CloseCompanyProps {
  companyId: string
  cardClass?: string
  headingClass?: string
  helpClass?: string
}

const people = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Closing the company: nobody gets in any more, nothing is deleted, and it can be reopened for 30 days. */
export function CloseCompany({ companyId, cardClass, headingClass, helpClass }: CloseCompanyProps) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const preview = useQuery({ ...closePreviewQuery(companyId), enabled: open })
  const close = useCloseCompany(companyId)
  const navigate = useNavigate()
  const p = preview.data
  const ready = Boolean(p && same(typed, p.name))

  const done = () => {
    setOpen(false)
    void navigate({ to: '/' })
  }

  return (
    <section className={cardClass} aria-label="Cerrar la empresa">
      <h2 className={headingClass}>Cerrar la empresa</h2>
      <p className={helpClass}>Si dejan de usar Visitario. Nadie más entra, ni vos, pero no se borra nada: durante 30 días la podés reabrir tal como estaba.</p>
      <Button variant="danger" size="md" className={styles.open} onClick={() => setOpen(true)}><Lock size={18} aria-hidden />Cerrar la empresa…</Button>

      <Sheet
        open={open}
        onClose={() => !close.isPending && setOpen(false)}
        title={p ? `Cerrar ${p.name}` : 'Cerrar la empresa'}
        footer={
          <div className={styles.actions}>
            <Button variant="ghost" size="md" onClick={() => setOpen(false)} disabled={close.isPending}>No, volver</Button>
            <Button variant="danger" size="md" disabled={!ready || p?.personal} loading={close.isPending}
              onClick={() => p && close.mutate({ name: typed, reason }, { onSuccess: done })}>
              {p ? `Cerrar ${p.name}` : 'Cerrar'}
            </Button>
          </div>
        }
      >
        {p?.personal ? (
          <Banner tone="info">Tu cuenta de trabajo independiente no se cierra desde acá. Escribinos a Visitario si querés darla de baja.</Banner>
        ) : p ? (
          <div className={styles.body}>
            <ul className={styles.effects} aria-label="Qué pasa al cerrarla">
              <li><b>{people(p.members, 'persona deja', 'personas dejan')} de entrar</b>, vos incluido.{p.invited ? ` ${people(p.invited, 'invitación queda cancelada', 'invitaciones quedan canceladas')}.` : ''}</li>
              <li><b>No se borra nada:</b> {people(p.stores, 'comercio', 'comercios')}, visitas, fotos y personas quedan guardados.</li>
              <li><b>La podés reabrir durante 30 días</b> desde tu perfil, y vuelve todo como estaba. Después, solo desde Visitario.</li>
            </ul>
            {p.daysToday ? (
              <Banner tone="warn">Hoy hay {people(p.daysToday, 'jornada publicada', 'jornadas publicadas')}: si alguien está trabajando, deja de poder cargar visitas.</Banner>
            ) : null}
            <TextArea label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300}
              placeholder="Ej.: Terminamos el piloto." />
            <Field label={`Para confirmar, escribí ${p.name}`} value={typed} onChange={(e) => setTyped(e.target.value)}
              autoComplete="off" spellCheck={false} />
            {close.error ? <Banner tone="error">{close.error.message}</Banner> : null}
          </div>
        ) : preview.isError ? (
          <Banner tone="error">No pudimos cargar los datos de la empresa. Probá de nuevo.</Banner>
        ) : (
          <p className={helpClass}>Cargando…</p>
        )}
      </Sheet>
    </section>
  )
}
