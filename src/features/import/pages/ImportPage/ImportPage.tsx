import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { addDays, todayInArgentina } from '@/domain/dates'
import type { Person } from '@/domain/import'
import { useWorkContext } from '@/features/workday/context'
import { teamDayQuery } from '@/features/team/api/queries'
import { useCatalogs } from '@/features/workday/api/queries'
import { pickable } from '@/features/workday/store-tags'
import { useAddSeller, useCanAddSellers } from '@/features/workday/api/sellers'
import { formatsQuery } from '@/features/import/api/import'
import { draftRows, emptyDraft, useDraft, useNames, type Draft } from '@/features/import/draft'
import { SourceStep } from './SourceStep'
import { ColumnsStep } from './ColumnsStep'
import { ReviewStep } from './ReviewStep'

export interface ImportSearch {
  date?: string
  person?: string
}

/** Importing a day: file or text → columns → review (S04, S05, SM04, SM05). */
export function ImportPage({ date: requested, person }: ImportSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const [date, setDate] = useState(requested ?? addDays(todayInArgentina(), 1))
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const team = useQuery({ ...teamDayQuery(ctx?.companyId ?? '', date), enabled: Boolean(ctx) })
  const formats = useQuery({ ...formatsQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx) })
  const { draft, setDraft, update, setColumn, setAlias } = useDraft(person ?? null)

  const people: Person[] = useMemo(
    // Whoever imports can assign to themselves too, if they are also a merchandiser.
    () => (team.data ?? []).map((m) => ({ id: m.personId, firstName: m.firstName, lastName: m.lastName, me: m.personId === ctx?.personId })),
    [team.data, ctx?.personId],
  )
  const catalogs = useCatalogs(ctx?.companyId ?? '').data
  const tags = useMemo(() => ({ sellers: pickable(catalogs?.sellers, null), channels: pickable(catalogs?.channels, null) }), [catalogs])
  const rows = useMemo(() => draftRows(draft, tags), [draft, tags])
  const canAdd = useCanAddSellers(ctx?.companyId ?? '')
  const newSeller = useAddSeller(ctx?.companyId ?? '')
  const names = useNames(rows, people, draft.mapping.aliases)
  if (!ctx) return null

  const toAssign = (imported?: number) => navigate({ to: '/s/assign', search: { date, person: draft.fallback ?? undefined, imported } })
  const read = (d: Draft, next: 2 | 3) => {
    setDraft({ ...d, fallback: d.fallback ?? people[0]?.id ?? null, formatName: d.formatName || `${ctx.companyName} diaria`.trim() })
    setStep(next)
  }

  if (step === 1) return <SourceStep companyId={ctx.companyId} tags={tags} onAddSeller={canAdd ? (name) => newSeller.mutateAsync(name) : undefined} draft={draft} formats={formats.data ?? []} onCancel={() => void toAssign()} onRead={read} />
  if (step === 2) {
    return (
      <ColumnsStep
        draft={draft} formats={formats.data ?? []} people={people} names={names} rows={rows.length}
        update={update} setColumn={setColumn} setAlias={setAlias}
        onBack={() => setStep(1)} onNext={() => setStep(3)}
      />
    )
  }
  return (
    <ReviewStep
      companyId={ctx.companyId} draft={draft} rows={rows} people={people} names={names} tags={tags}
      date={date} onDate={setDate} update={update} setAlias={setAlias}
      onBack={() => setStep(draft.lines ? 1 : 2)}
      onDiscard={() => {
        setDraft(emptyDraft(draft.fallback))
        void toAssign()
      }}
      onImported={(result) => void toAssign(result.visits)}
    />
  )
}
