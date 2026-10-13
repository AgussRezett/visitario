import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Download } from 'lucide-react'
import { KIND_LABEL, PLAN_LABEL, RETENTION_MONTHS, formatAmount, formatBytes, planNotice } from '@/domain/company'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { Switch } from '@/ui/Switch'
import { useWorkContext } from '@/features/workday/context'
import { companyQuery, exportCsv, saveFile, subscriptionQuery, usageQuery, useCompanyUpdate } from '@/features/admin/api/company'
import styles from './CompanyPage.module.scss'

const PLAN_TEXT: Record<string, string> = {
  pilot: 'Mientras dure el piloto, todo está habilitado sin cargo. El precio se define al terminar.',
  free: 'Funciones básicas sin cargo.',
  team: 'Todo habilitado para tu equipo.',
  internal: 'Cuenta interna de Visitario.',
}

/** The company's data, plan, billing, usage and its data (D04 / DM05). */
export function CompanyPage() {
  const ctx = useWorkContext()
  const companyId = ctx?.companyId ?? ''
  const company = useQuery({ ...companyQuery(companyId), enabled: Boolean(ctx) })
  const subscription = useQuery({ ...subscriptionQuery(companyId), enabled: Boolean(ctx) })
  const usage = useQuery({ ...usageQuery(companyId), enabled: Boolean(ctx) })
  const update = useCompanyUpdate(companyId)
  const [name, setName] = useState('')
  const [exporting, setExporting] = useState<'stores' | 'visits' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  useEffect(() => setName(company.data?.name ?? ''), [company.data?.name])
  if (!ctx) return null

  const c = company.data
  const s = subscription.data
  const notice = s ? planNotice(s) : null
  const download = async (what: 'stores' | 'visits') => {
    setExporting(what)
    setExportError(null)
    try {
      saveFile(`${(c?.name ?? 'visitario').toLowerCase().replace(/\W+/g, '-')}-${what === 'stores' ? 'comercios' : 'visitas'}-${todayInArgentina()}.csv`, await exportCsv(companyId, what))
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'No pudimos exportar.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName} · admin</span>
        <h1 className={styles.title}>Empresa y plan</h1>
      </header>
      {update.error ? <Banner tone="error">{update.error.message}</Banner> : null}

      <div className={styles.grid}>
        <section className={styles.plan} aria-label="Plan">
          <h2 className={styles.planTitle}>{s ? PLAN_LABEL[s.plan] : 'Plan'}</h2>
          <p className={styles.planText}>{s ? PLAN_TEXT[s.plan] : ''}</p>
          <div className={styles.kpis}>
            <span className={styles.kpi}><b>{usage.data?.activePeople ?? '—'}</b>usuarios activos</span>
            <span className={styles.kpi}><b>{usage.data ? formatBytes(usage.data.photoBytes) : '—'}</b>de fotos</span>
            <span className={styles.kpi}><b>{usage.data?.visitsThisMonth ?? '—'}</b>visitas este mes</span>
          </div>
        </section>

        <section className={styles.card} aria-label="Facturación">
          <h2 className={styles.heading}>Facturación</h2>
          {notice ? <Banner tone={notice.tone} icon={<CalendarClock size={18} aria-hidden />} title={notice.title}>{notice.text}</Banner> : null}
          {s ? (
            <dl className={styles.kv}>
              <div><dt>Próxima facturación</dt><dd>{s.nextBillingOn ? formatDayMonth(s.nextBillingOn, true) : 'Sin fecha'}</dd></div>
              <div><dt>Forma de pago</dt><dd>{s.autoDebit ? `Débito automático${s.paymentMethod ? ` · ${s.paymentMethod}` : ''}` : s.paymentMethod ?? 'Sin débito automático'}</dd></div>
              <div><dt>Monto estimado</dt><dd>{formatAmount(s.estimatedAmountCents, s.currency)}</dd></div>
            </dl>
          ) : subscription.isPending ? <Skeleton height={96} /> : null}
          <p className={styles.help}>Por ahora el cobro es manual: para cambiar la forma de pago o el plan, avisale a Visitario. Sin débito automático, el plan vence en la fecha indicada y las funciones pagas se pausan hasta renovar.</p>
        </section>

        <section className={styles.card} aria-label="Datos de la empresa">
          <h2 className={styles.heading}>Datos de la empresa</h2>
          {c ? (
            <>
              <form className={styles.nameRow} onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== c.name) update.mutate({ name: name.trim() }) }}>
                <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                <Button type="submit" variant="secondary" size="md" disabled={!name.trim() || name.trim() === c.name} loading={update.isPending && update.variables?.name !== undefined}>Guardar</Button>
              </form>
              <p className={styles.kind}>Tipo: {KIND_LABEL[c.kind]}</p>
              <Segmented label="Buscar direcciones en" value={c.geocodingScope} onChange={(v) => update.mutate({ geocodingScope: v })}
                options={[{ value: 'caba', label: 'CABA' }, { value: 'argentina', label: 'Toda Argentina' }]} />
              <p className={styles.help}>Dónde buscamos las direcciones nuevas al agregarlas o importarlas.</p>
            </>
          ) : <Skeleton height={160} />}
        </section>

        <section className={styles.card} aria-label="Funciones">
          <h2 className={styles.heading}>Funciones</h2>
          <Switch checked={c?.showWhatsapp ?? true} disabled={!c} onChange={(on) => update.mutate({ showWhatsapp: on })}>
            Mensajes para WhatsApp
            <span className={styles.help}>Puente mientras el supervisor no revise en Visitario.</span>
          </Switch>
        </section>

        <section className={styles.card} aria-label="Tus datos">
          <h2 className={styles.heading}>Tus datos</h2>
          <p className={styles.help}>Las fotos, comercios y visitas son de {c?.name ?? ctx.companyName}. Ninguna otra empresa puede verlos.</p>
          <Select label="Guardar fotos durante" value={c?.photoRetentionMonths ?? 12} disabled={!c}
            onChange={(e) => update.mutate({ photoRetentionMonths: Number(e.target.value) })}
            options={RETENTION_MONTHS.map((m) => ({ value: m, label: `${m} meses` }))} />
          <div className={styles.exports}>
            <Button variant="secondary" size="md" loading={exporting === 'visits'} disabled={Boolean(exporting)} onClick={() => void download('visits')}><Download size={18} aria-hidden />Exportar visitas</Button>
            <Button variant="secondary" size="md" loading={exporting === 'stores'} disabled={Boolean(exporting)} onClick={() => void download('stores')}><Download size={18} aria-hidden />Exportar comercios</Button>
          </div>
          <p className={styles.help}>{usage.data ? `${usage.data.stores} comercios · ` : ''}En planillas .csv que abre Excel. Las fotos quedan en Visitario.</p>
          {exportError ? <Banner tone="error">{exportError}</Banner> : null}
        </section>
      </div>
    </div>
  )
}
