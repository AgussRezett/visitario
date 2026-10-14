import { useEffect, useState } from 'react'
import { MessageCircle, Power, RotateCcw, X } from 'lucide-react'
import { ROLE_HELP, STATUS_LABEL, invitationMessage, nextActions, whatsappLink, type CompanyPerson, type Team } from '@/domain/people'
import { ROLE_LABEL, ROLE_PRIORITY, type Role } from '@/domain/roles'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { Switch } from '@/ui/Switch'
import { ToggleTags } from '@/ui/ToggleTag'
import { shiftLabel } from '@/domain/team'
import { useAdminPeople } from '@/features/admin/api/people'
import styles from './PersonSheet.module.scss'

interface PersonSheetProps {
  person: CompanyPerson | null
  teams: Team[]
  companyId: string
  companyName: string
  /** The company's hours, the default for everyone. */
  companyShift: { start: string; end: string } | null
  onClose: () => void
}

/** Roles, team and start date of someone in the company; deactivate, bring back, cancel the invitation. */
export function PersonSheet({ person, teams, companyId, companyName, companyShift, onClose }: PersonSheetProps) {
  const { update } = useAdminPeople(companyId)
  const { confirm, dialog } = useConfirm()
  const [roles, setRoles] = useState<Role[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [startsOn, setStartsOn] = useState('')
  const [ownHours, setOwnHours] = useState<{ start: string; end: string } | null>(null)

  useEffect(() => {
    if (!person) return
    setRoles(person.roles)
    setTeamId(person.teamId)
    setStartsOn(person.startsOn)
    setOwnHours(person.shift)
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new person starts a new form
  }, [person?.membershipId])

  if (!person) return null
  const name = `${person.firstName} ${person.lastName}`
  const hoursChanged = JSON.stringify(ownHours) !== JSON.stringify(person.shift)
  const hoursValid = !ownHours || ownHours.start < ownHours.end
  const changed = roles.join() !== person.roles.join() || teamId !== person.teamId || startsOn !== person.startsOn || hoursChanged
  const save = async () => {
    await update.mutateAsync({ membershipId: person.membershipId, roles, teamId, startsOn, ...(hoursChanged ? { shift: ownHours } : {}) })
    onClose()
  }
  const setStatus = async (status: CompanyPerson['status'], question: { title: string; description: string; confirmLabel: string; tone?: 'danger' }) => {
    if (!(await confirm(question))) return
    await update.mutateAsync({ membershipId: person.membershipId, status })
    onClose()
  }
  const invite = whatsappLink(invitationMessage(person.firstName, companyName, window.location.origin))

  return (
    <Sheet
      open
      onClose={onClose}
      title={name}
      subtitle={`${STATUS_LABEL[person.status]}${person.phoneLast4 ? ` · celular •••• ${person.phoneLast4}` : ''}`}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
          <Button size="md" disabled={!changed || !roles.length || !hoursValid} loading={update.isPending} onClick={save}>Guardar cambios</Button>
        </>
      }
    >
      <div className={styles.block}>
        <span className={styles.label}>Rol en {companyName}</span>
        <ToggleTags
          label="Roles"
          options={ROLE_PRIORITY.map((r) => ({ value: r, label: r === 'admin' ? 'Admin de empresa' : ROLE_LABEL[r] }))}
          selected={roles}
          onToggle={(r) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))}
        />
        <p className={styles.help}>{ROLE_PRIORITY.filter((r) => roles.includes(r)).map((r) => `${ROLE_LABEL[r]}: ${ROLE_HELP[r].toLowerCase()}`).join(' · ') || 'Elegí al menos un rol.'}</p>
      </div>
      <div className={styles.pair}>
        <Select
          label={roles.includes('supervisor') && !roles.includes('merchandiser') ? 'Equipo que supervisa' : 'Equipo'}
          options={[{ value: '', label: 'Sin equipo' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
          value={teamId ?? ''}
          onChange={(e) => setTeamId(e.target.value || null)}
        />
        <Field label="Desde" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </div>

      <div className={styles.block}>
        <Switch checked={Boolean(ownHours)} onChange={(on) => setOwnHours(on ? person.shift ?? companyShift ?? { start: '09:00', end: '14:00' } : null)}>
          Horario propio
          <span className={styles.help}>{ownHours ? 'Distinto del de la empresa.' : companyShift ? `Usa el de la empresa: ${shiftLabel(companyShift)}.` : 'Usa el de la empresa.'}</span>
        </Switch>
        {ownHours ? (
          <div className={styles.pair}>
            <Field label="Desde" type="time" value={ownHours.start} onChange={(e) => setOwnHours((h) => (h ? { ...h, start: e.target.value } : h))} />
            <Field label="Hasta" type="time" value={ownHours.end} onChange={(e) => setOwnHours((h) => (h ? { ...h, end: e.target.value } : h))} error={hoursValid ? undefined : 'Tiene que terminar después de empezar.'} />
          </div>
        ) : null}
      </div>

      {update.error ? <Banner tone="error">{update.error.message}</Banner> : null}

      <div className={styles.actions}>
        {nextActions(person).map((a) =>
          a === 'deactivate' ? (
            <Button key={a} variant="ghost" size="sm" onClick={() => setStatus('disabled', { title: `¿Desactivar a ${person.firstName}?`, description: 'Deja de ver las jornadas de la empresa. Su historial queda; podés reactivarlo cuando quieras.', confirmLabel: 'Desactivar', tone: 'danger' })}>
              <Power size={16} aria-hidden />Desactivar
            </Button>
          ) : a === 'reactivate' ? (
            <Button key={a} variant="ghost" size="sm" onClick={() => setStatus('active', { title: `¿Reactivar a ${person.firstName}?`, description: 'Vuelve a ver sus jornadas con el rol y equipo de arriba.', confirmLabel: 'Reactivar' })}>
              <RotateCcw size={16} aria-hidden />Reactivar
            </Button>
          ) : a === 'cancel' ? (
            <Button key={a} variant="ghost" size="sm" onClick={() => setStatus('declined', { title: '¿Cancelar la invitación?', description: `${person.firstName} ya no la va a ver en su perfil. Podés invitarlo de nuevo con su DNI.`, confirmLabel: 'Cancelar invitación', tone: 'danger' })}>
              <X size={16} aria-hidden />Cancelar invitación
            </Button>
          ) : a === 'share' ? (
            <a key={a} className={styles.whatsapp} href={invite} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden />Mandar la invitación por WhatsApp
            </a>
          ) : (
            <p key={a} className={styles.help}>Para invitarlo de nuevo, dalo de alta otra vez con su DNI.</p>
          ),
        )}
      </div>
      {dialog}
    </Sheet>
  )
}
