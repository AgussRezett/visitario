import { useState } from 'react'
import { Check, Copy, Download, ExternalLink, House, Maximize2, WifiOff } from 'lucide-react'
import { chromeIntent, isIos } from '@/domain/install'
import { useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { promptInstall, useInstall } from '@/features/install/state'
import { stepsFor } from '@/features/install/steps'
import styles from './InstallSheet.module.scss'

const BENEFITS = [
  { icon: House, text: 'Se abre desde la pantalla de inicio, como cualquier app.' },
  { icon: WifiOff, text: 'Funciona sin señal: lo que cargás se guarda y se manda después.' },
  { icon: Maximize2, text: 'Pantalla completa, sin la barra del navegador.' },
]

interface InstallSheetProps {
  open: boolean
  /** later: "Ahora no", it rests a week · done: installed here, no more offers · closed: nothing to remember. */
  onClose: (reason: 'later' | 'done' | 'closed') => void
}

/** How to install Visitario on this device: one tap where the browser allows it, steps elsewhere. */
export function InstallSheet({ open, onClose }: InstallSheetProps) {
  const { kind, ua } = useInstall()
  const { copied, copy } = useCopy()
  const [busy, setBusy] = useState(false)
  const touch = navigator.maxTouchPoints > 1
  const steps = stepsFor(kind, ua, touch)
  const link = `${window.location.origin}/`
  const androidInApp = kind === 'in-app' && !isIos({ ua, touch })

  const install = async () => {
    setBusy(true)
    try {
      const outcome = await promptInstall()
      if (outcome === 'accepted') onClose('done')
    } finally {
      setBusy(false)
    }
  }

  const later = <Button variant="secondary" size="md" onClick={() => onClose('later')} className={styles.later}>Ahora no</Button>
  const footer =
    kind === 'installed' ? (
      <Button size="md" onClick={() => onClose('closed')}>Listo</Button>
    ) : kind === 'native' ? (
      <>{later}<Button size="md" loading={busy} onClick={() => void install()}><Download size={18} aria-hidden />Instalar Visitario</Button></>
    ) : (
      <>{later}<Button size="md" onClick={() => onClose('done')}><Check size={18} aria-hidden />Ya lo instalé</Button></>
    )

  return (
    <Sheet open={open} onClose={() => onClose(kind === 'installed' ? 'closed' : 'later')} title={kind === 'installed' ? 'Visitario ya está instalado' : 'Instalá Visitario'}
      subtitle={kind === 'installed' ? 'Lo estás usando como app.' : 'Es una app que se instala desde el navegador, sin tienda de apps.'} footer={footer}>
      <ul className={styles.benefits}>
        {BENEFITS.map((b) => (
          <li key={b.text} className={styles.benefit}>
            <span className={styles.benefitIcon} aria-hidden><b.icon size={18} /></span>
            {b.text}
          </li>
        ))}
      </ul>

      {kind === 'native' ? <p className={styles.lead}>Tocá <b>Instalar Visitario</b> y confirmá: en segundos queda en tu pantalla de inicio.</p> : null}
      {kind === 'in-app' ? <p className={styles.lead}>Estás viendo Visitario dentro de otra app. Para instalarlo, abrilo en {isIos({ ua, touch }) ? 'Safari' : 'Chrome'}.</p> : null}
      {kind === 'unsupported' ? <p className={styles.lead}>Este navegador no instala apps. Abrí Visitario en Chrome o Edge, o desde tu celular.</p> : null}

      {steps.length ? (
        <ol className={styles.steps} aria-label="Pasos para instalar">
          {steps.map((s, i) => (
            <li key={s.text} className={styles.step}>
              <span className={styles.number} aria-hidden>{i + 1}</span>
              <span className={styles.stepBody}>
                <span>{s.text}</span>
                {s.key ? (
                  <span className={styles.key}><s.key.icon size={16} aria-hidden />{s.key.label}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {kind === 'in-app' || kind === 'ios-other' || kind === 'unsupported' ? (
        <div className={styles.links}>
          {androidInApp ? (
            <a className={styles.open} href={chromeIntent(window.location.href)}><ExternalLink size={18} aria-hidden />Abrir en Chrome</a>
          ) : null}
          <Button variant="secondary" size="md" onClick={() => copy('link', link)}>
            {copied === 'link' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
            {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
          </Button>
        </div>
      ) : null}
    </Sheet>
  )
}
