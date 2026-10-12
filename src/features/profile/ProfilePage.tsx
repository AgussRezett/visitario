import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, LogOut, Pencil } from 'lucide-react'
import { formatDni } from '@/domain/identity'
import { ROLE_LABEL } from '@/domain/roles'
import { Avatar } from '@/ui/Avatar'
import { initials } from '@/lib/format'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Segmented } from '@/ui/Segmented'
import { signOut } from '@/features/auth/api'
import type { Me } from '@/features/auth/me'
import { EditNameForm } from './EditNameForm'
import { Invitations } from './Invitations'
import { SecurityCard } from './SecurityCard'
import { getThemeChoice, setThemeChoice, type ThemeChoice } from './theme'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  )
}

function formatPhone(e164: string | null) {
  if (!e164) return null
  const d = e164.replace(/^\+549/, '')
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}` : e164
}

/** Same profile for every role, on phone and desktop (wireframes A17 / P01 / P02). */
export function ProfilePage({ me }: { me: Me & { person: NonNullable<Me['person']> } }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice)
  const p = me.person
  const name = `${p.firstName} ${p.lastName}`

  return (
    <div className="flex flex-col gap-5 px-5 pt-4 lg:px-8 lg:pt-8">
      <div className="flex items-center gap-4">
        <Avatar name={initials(p.firstName, p.lastName)} size={56} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="eyebrow hidden lg:block">Mi perfil</p>
          <h1 className="truncate text-title font-extrabold lg:text-display">{name}</h1>
          <p className="text-label text-ink-subtle">
            DNI {formatDni(p.dni)}
            {p.phone ? ` · ${formatPhone(p.phone)}` : ''}
            {me.email ? <span className="hidden lg:inline"> · {me.email}</span> : null}
          </p>
        </div>
        {!editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label="Editar mis datos">
            <Pencil size={16} aria-hidden />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        ) : null}
      </div>
      {editing ? <Card><EditNameForm personId={p.id} defaults={{ firstName: p.firstName, lastName: p.lastName }} onDone={() => setEditing(false)} /></Card> : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Section title="Mis empresas y roles">
            {me.memberships.length ? (
              <Card className="gap-0 py-1">
                {me.memberships.map((m, i) => (
                  <div key={m.companyId} className={`flex min-h-15 items-center gap-3 py-3 ${i < me.memberships.length - 1 ? 'border-b border-line' : ''}`}>
                    <Building2 size={20} className="shrink-0 text-ink-subtle" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-label font-bold">{m.companyName}</span>
                      <span className="text-label text-ink-subtle">{m.roles.map((r) => ROLE_LABEL[r]).join(' · ')}</span>
                    </div>
                    <span className="rounded-full bg-done-soft px-2.5 py-1 text-xs font-bold text-done-ink">Activa</span>
                  </div>
                ))}
              </Card>
            ) : (
              <p className="text-label text-ink-subtle">Todavía no pertenecés a ninguna empresa.</p>
            )}
            <Invitations invitations={me.invitations} />
          </Section>
        </div>
        <div className="flex flex-col gap-5">
          <Section title="Seguridad">
            <SecurityCard me={me} />
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              size="md"
              onClick={async () => {
                await signOut()
                queryClient.clear()
                await navigate({ to: '/login' })
              }}
            >
              <LogOut size={18} aria-hidden />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
