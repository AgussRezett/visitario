import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, RefreshCw, Undo2 } from 'lucide-react'
import { buildDailyReport } from '@/domain/report'
import { TEMPLATE_FIELDS, fillTemplate, type TemplateKind } from '@/domain/templates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Switch } from '@/ui/Switch'
import { TextArea } from '@/ui/TextArea'
import { useCatalogs } from '@/features/workday/api/queries'
import { useWorkContext } from '@/features/workday/context'
import { messageValues } from '@/features/workday/visit-text'
import { companyQuery, useCompanyUpdate } from '@/features/admin/api/company'
import { sampleMetricsQuery, sampleVisitsQuery, templatesQuery, useSaveTemplate } from '@/features/admin/api/templates'
import styles from './TemplatesPage.module.scss'

const KINDS: { kind: TemplateKind; title: string; help: string }[] = [
  { kind: 'before', title: 'Mensaje ANTES', help: 'Al empezar a trabajar' },
  { kind: 'after', title: 'Mensaje DESPUÉS', help: 'Al terminar la visita' },
  { kind: 'daily_report', title: 'Informe del día', help: 'Resumen con totales' },
]

/** The ANTES / DESPUÉS messages and the daily report, with a preview on a real visit (D03 / DM03). */
export function TemplatesPage() {
  const ctx = useWorkContext()
  const companyId = ctx?.companyId ?? ''
  const saved = useQuery({ ...templatesQuery(companyId), enabled: Boolean(ctx) })
  const company = useQuery({ ...companyQuery(companyId), enabled: Boolean(ctx) })
  const samples = useQuery({ ...sampleVisitsQuery(companyId, ctx?.personId ?? ''), enabled: Boolean(ctx) })
  const catalogs = useCatalogs(companyId)
  const save = useSaveTemplate(companyId)
  const updateCompany = useCompanyUpdate(companyId)
  const [kind, setKind] = useState<TemplateKind>('after')
  const [drafts, setDrafts] = useState<Partial<Record<TemplateKind, string>>>({})
  const [sample, setSample] = useState(0)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => save.reset(), [kind]) // eslint-disable-line react-hooks/exhaustive-deps -- the saved notice is per template
  const body = drafts[kind] ?? saved.data?.[kind] ?? ''
  const changed = saved.data ? body !== saved.data[kind] : false
  const setBody = (text: string) => setDrafts((d) => ({ ...d, [kind]: text }))

  // Finished visits first: they have everything a message can show.
  const visits = useMemo(() => [...(samples.data ?? [])].sort((a, b) => Number(Boolean(b.finishedAt)) - Number(Boolean(a.finishedAt))), [samples.data])
  const visit = visits.length ? visits[sample % visits.length] : undefined
  const sameDay = useMemo(() => (visit ? (samples.data ?? []).filter((v) => v.workdayId === visit.workdayId) : []), [samples.data, visit])
  const metrics = useQuery(sampleMetricsQuery(kind === 'daily_report' ? sameDay.map((v) => v.id) : []))
  const typeName = (id: number) => catalogs.data?.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'

  const preview = !visit
    ? ''
    : kind === 'daily_report'
      ? buildDailyReport({
          date: visit.workDate,
          visits: sameDay.map((v) => ({ address: v.store.address, added: v.source === 'added', workStatus: v.workStatus })),
          metrics: (catalogs.data?.metrics ?? []).map((m) => ({ name: m.name, reportLabel: m.reportLabel, total: metrics.data?.[m.id] ?? 0 })),
          template: body,
        })
      : fillTemplate(body, messageValues(visit, visit.merchandiserName.split(' ')[0] ?? '', typeName))

  const insert = (token: string) => {
    const el = area.current
    const text = `{${token}}`
    if (!el) return setBody(body + text)
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    setBody(body.slice(0, start) + text + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + text.length, start + text.length)
    })
  }

  if (!ctx) return null
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>{ctx.companyName} · admin</span>
          <h1 className={styles.title}>Plantillas de mensajes</h1>
        </div>
      </header>

      <div className={styles.columns}>
        <section className={styles.side} aria-label="Plantillas">
          <div className={styles.kinds} role="radiogroup" aria-label="Plantilla">
            {KINDS.map((k) => (
              <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} className={styles.kind} onClick={() => setKind(k.kind)}>
                <span className={styles.kindTitle}>{k.title}{drafts[k.kind] !== undefined && drafts[k.kind] !== saved.data?.[k.kind] ? ' ·' : ''}</span>
                <span className={styles.kindHelp}>{k.help}</span>
              </button>
            ))}
          </div>
          <div className={styles.whatsapp}>
            <Switch checked={company.data?.showWhatsapp ?? true} disabled={!company.data || updateCompany.isPending} onChange={(on) => updateCompany.mutate({ showWhatsapp: on })}>
              Mostrar los botones de WhatsApp a los activadores
            </Switch>
            <p className={styles.help}>Desactivalos cuando todo el equipo revise en Visitario.</p>
          </div>
        </section>

        <section className={styles.editor} aria-label="Editor">
          <TextArea ref={area} label="Texto" value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={styles.text} maxLength={4000}
            help="Si un dato está vacío, su línea no se muestra." />
          <span className={styles.label}>Insertar dato</span>
          <div className={styles.tokens}>
            {TEMPLATE_FIELDS[kind].map((f) => (
              <button key={f.token} type="button" className={styles.token} onClick={() => insert(f.token)} title={f.label} aria-label={`Insertar ${f.label}`}>{`{${f.token}}`}</button>
            ))}
          </div>
        </section>

        <section className={styles.preview} aria-label="Vista previa">
          <span className={styles.eyebrow}>Vista previa con una visita real</span>
          {visit ? (
            <>
              <div className={styles.chat}><p className={styles.bubble}>{preview}</p></div>
              <span className={styles.help}>{visit.store.name ?? visit.store.address} · {visit.merchandiserName}</span>
              {visits.length > 1 ? (
                <Button variant="secondary" size="sm" onClick={() => setSample((i) => i + 1)} className={styles.another}><RefreshCw size={16} aria-hidden />Probar con otra visita</Button>
              ) : null}
            </>
          ) : (
            <p className={styles.help}>{samples.isPending ? 'Buscando una visita…' : 'Cuando haya visitas cargadas, las vas a ver acá con esta plantilla.'}</p>
          )}
        </section>
      </div>

      {save.isSuccess && !changed ? <Banner tone="ok" icon={<Check size={18} aria-hidden />}>Guardada: los activadores la usan desde su próxima visita.</Banner> : null}
      {save.error ?? updateCompany.error ? <Banner tone="error">{(save.error ?? updateCompany.error)?.message}</Banner> : null}
      <div className={styles.footer}>
        <Button variant="secondary" size="md" disabled={!changed} onClick={() => setDrafts((d) => ({ ...d, [kind]: undefined }))}><Undo2 size={18} aria-hidden />Descartar cambios</Button>
        <Button size="md" disabled={!changed || !body.trim()} loading={save.isPending} onClick={() => save.mutate({ kind, body })}><Check size={18} aria-hidden />Guardar</Button>
      </div>
    </div>
  )
}
