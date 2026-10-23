import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, LogOut, ShieldCheck } from 'lucide-react'
import { ROLE_LABEL } from '@/domain/roles'
import { Button, buttonClass } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Segmented } from '@/ui/Segmented'
import { signOut } from '@/features/auth/api'
import { getSync } from '@/features/sync/outbox'
import type { Me } from '@/features/auth/me'
import { Invitations } from '@/features/profile/components/Invitations'
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '@/features/profile/theme'
import { EmailRow } from './EmailRow'
import { PersonalDataCard } from './PersonalDataCard'
import { ProfileHeader } from './ProfileHeader'
import { SecurityCard } from './SecurityCard'
import { InstallRow } from '@/features/install/components/InstallRow'
import styles from './ProfilePage.module.scss'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

/** Same profile for every role, on phone and desktop (wireframes A17 / P01 / P02). */
export function ProfilePage({ me }: { me: Me & { person: NonNullable<Me['person']> } }) {
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  const queryClient = useQueryClient()
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice)
  const p = me.person

  return (
    <div className={styles.page}>
      <ProfileHeader me={me} person={p} />

      <div className={styles.columns}>
        <div className={styles.column}>
          <Section title="Mis datos">
            <PersonalDataCard person={p} />
          </Section>
          <Section title="Mis empresas y roles">
            {me.memberships.length ? (
              <Card className={styles.list}>
                {me.memberships.map((m) => (
                  <div key={m.companyId} className={styles.company}>
                    <Building2 size={20} className={styles.companyIcon} aria-hidden />
                    <div className={styles.companyText}>
                      <span className={styles.companyName}>{m.companyName}</span>
                      <span className={styles.companyRoles}>{m.roles.map((r) => ROLE_LABEL[r]).join(' · ')}</span>
                    </div>
                    <span className={styles.badge}>Activa</span>
                  </div>
                ))}
              </Card>
            ) : (
              <p className={styles.empty}>Todavía no pertenecés a ninguna empresa.</p>
            )}
            <Invitations invitations={me.invitations} />
            {me.isPlatformAdmin ? (
              <Link to="/platform" className={buttonClass('secondary', 'md', styles.platform)}>
                <ShieldCheck size={18} aria-hidden />Panel de Visitario · super admin
              </Link>
            ) : null}
          </Section>
        </div>
        <div className={styles.column}>
          <Section title="Cuenta y seguridad">
            <Card className={styles.list}><EmailRow me={me} /></Card>
            <SecurityCard me={me} />
          </Section>
          <Section title="App en este dispositivo">
            <InstallRow />
          </Section>
          <Section title="Apariencia en este dispositivo">
            <Segmented
              label="Tema"
              value={theme}
              onChange={(v) => {
                setTheme(v)
                setThemeChoice(v)
              }}
              options={[
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
                { value: 'auto', label: 'Automático' },
              ]}
            />
          </Section>
          <div className={styles.actions}>
            <Button
              variant="danger"
              size="md"
              onClick={async () => {
                const unsent = getSync().rows.filter((r) => !r.sent).length
                if (
                  unsent &&
                  !(await confirm({
                    title: 'Tenés cambios sin enviar',
                    description: `${unsent === 1 ? 'Hay 1 cambio que todavía no llegó' : `Hay ${unsent} cambios que todavía no llegaron`} al servidor. Si cerrás sesión se pierden. Esperá a tener señal para que se envíen.`,
                    confirmLabel: 'Cerrar igual',
                    tone: 'danger',
                  }))
                )
                  return
                await signOut()
                queryClient.clear()
                await navigate({ to: '/login' })
              }}
            >
              <LogOut size={18} aria-hidden />
              Cerrar sesión
            </Button>
            {dialog}
          </div>
        </div>
      </div>
    </div>
  )
}
