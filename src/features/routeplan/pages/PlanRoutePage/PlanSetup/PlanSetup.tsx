import { GOALS, NEVER, countOptions, type PlanFilters, type PlanGoal } from '@/domain/route-plan'
import { toIds } from '@/domain/filters'
import type { TravelMode } from '@/domain/route'
import { MultiSelect, Select } from '@/ui/Select'
import { Segmented } from '@/ui/Segmented'
import { Switch } from '@/ui/Switch'
import { sellerOption } from '@/features/people/person-options'
import styles from './PlanSetup.module.scss'

export type SetupFilters = Omit<PlanFilters, 'zone'>

interface PlanSetupProps {
  goal: PlanGoal
  onGoal: (g: PlanGoal) => void
  filters: SetupFilters
  onFilters: (patch: Partial<SetupFilters>) => void
  count: number
  onCount: (n: number) => void
  mode: TravelMode
  onMode: (m: TravelMode) => void
  sellers: { id: number; name: string; personId: string | null }[]
  channels: { id: number; name: string }[]
  displayTypes: { id: number; name: string }[]
  areas: string[]
}

const RAPPORT_MIN = [
  { value: 'any', label: 'Cualquiera' },
  { value: '0.5', label: 'Indiferente o mejor' },
  { value: '1.5', label: 'Con restricciones o mejor' },
  { value: '2.5', label: 'Buena onda' },
]
const STALE = [
  { value: 'any', label: 'Cualquiera' },
  ...[7, 15, 30, 60].map((d) => ({ value: String(d), label: `Más de ${d} días` })),
  { value: 'never', label: 'Nunca activados' },
]
const num = (v: string) => (v === 'any' ? null : v === 'never' ? NEVER : Number(v))
const staleValue = (d: number | null) => (d === null ? 'any' : d === NEVER ? 'never' : String(d))

/** What the route is for and which stores may go. */
export function PlanSetup({ goal, onGoal, filters: f, onFilters: set, count, onCount, mode, onMode, sellers, channels, displayTypes, areas }: PlanSetupProps) {
  return (
    <>
      <fieldset className={styles.goals}>
        <legend className={styles.legend}>Objetivo</legend>
        {GOALS.map((g) => (
          <label key={g.value} className={styles.goal} data-on={g.value === goal || undefined}>
            <input type="radio" name="goal" value={g.value} checked={g.value === goal} onChange={() => onGoal(g.value)} className={styles.radio} />
            <span className={styles.goalName}>{g.label}</span>
            <span className={styles.goalHelp}>{g.help}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.filters}>
        <MultiSelect label="Vendedor" values={f.sellerIds.map(String)} onChange={(v) => set({ sellerIds: toIds(v) })} allLabel="Todos" noun="vendedores"
          options={[...sellers.map(sellerOption), { value: '0', label: 'Sin vendedor' }]} />
        <MultiSelect label="Barrio" values={f.areas} onChange={(v) => set({ areas: v })} allLabel="Todos" noun="barrios" options={areas.map((a) => ({ value: a, label: a }))} />
        <MultiSelect label="Canal" values={f.channelIds.map(String)} onChange={(v) => set({ channelIds: toIds(v) })} allLabel="Todos" noun="canales"
          options={[...channels.map((c) => ({ value: String(c.id), label: c.name })), { value: '0', label: 'Sin canal' }]} />
        <MultiSelect label="Exhibición" values={f.displayTypeIds.map(String)} onChange={(v) => set({ displayTypeIds: toIds(v) })} allLabel="Todas" noun="exhibiciones"
          options={[...displayTypes.map((t) => ({ value: String(t.id), label: t.name })), { value: '0', label: 'Sin exhibiciones registradas' }]} />
        <Select label="Trato" value={f.minRapport === null ? 'any' : String(f.minRapport)} onChange={(v) => set({ minRapport: num(v) })} options={RAPPORT_MIN} />
        <Select label="Sin activar hace" value={staleValue(f.staleDays)} onChange={(v) => set({ staleDays: num(v) })} options={STALE} />
        <Select label="Locales" value={count} onChange={(v) => onCount(Number(v))} options={countOptions(count).map((n) => ({ value: n, label: `${n} locales` }))} />
      </div>
      <Segmented label="Cómo se mueve" value={mode} onChange={onMode} options={[{ value: 'walking', label: 'A pie' }, { value: 'driving', label: 'En auto' }]} />
      <Switch checked={f.includePlanned} onChange={(on) => set({ includePlanned: on })}>
        Incluir los que ya están en otra jornada ese día
      </Switch>
    </>
  )
}
