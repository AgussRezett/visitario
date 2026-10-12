import { useState } from 'react'
import { Camera, Download, LocateFixed } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'

type State = 'idle' | 'granted' | 'denied'

function Row({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-forest dark:text-lime">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        <span className="text-label text-ink-muted">{text}</span>
      </span>
      {action}
    </div>
  )
}

function stateLabel(s: State) {
  return s === 'granted' ? 'Permitido' : s === 'denied' ? 'Bloqueado' : null
}

/** One-time permissions (wireframes A02-permisos / AD02). Location is optional and only used for routes. */
export function PermissionsStep({ onDone }: { onDone: () => void }) {
  const [location, setLocation] = useState<State>('idle')
  const [camera, setCamera] = useState<State>('idle')

  const askLocation = () =>
    navigator.geolocation.getCurrentPosition(
      () => setLocation('granted'),
      () => setLocation('denied'),
      { maximumAge: 60_000, timeout: 10_000 },
    )

  const askCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCamera('granted')
    } catch {
      setCamera('denied')
    }
  }

  const action = (s: State, onClick: () => void) =>
    stateLabel(s) ? (
      <span className="text-label font-bold text-done-ink">{stateLabel(s)}</span>
    ) : (
      <Button variant="secondary" size="sm" onClick={onClick}>Permitir</Button>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-extrabold tracking-tight">Dejemos todo listo</h1>
        <p className="text-ink-muted">Lo hacés una sola vez. Podés cambiarlo cuando quieras desde tu perfil.</p>
      </div>
      <Card className="gap-4 p-5">
        <Row icon={<Camera size={20} aria-hidden />} title="Cámara" text="Para la fachada, el antes y el después." action={action(camera, askCamera)} />
        <Row icon={<LocateFixed size={20} aria-hidden />} title="Ubicación (opcional)" text="Solo para armar el recorrido desde donde estás. Nunca en segundo plano." action={action(location, askLocation)} />
        <Row
          icon={<Download size={20} aria-hidden />}
          title="Instalar en el celular"
          text="Abrí visitario en el navegador del celular y elegí Agregar a la pantalla de inicio. Funciona sin señal."
          action={null}
        />
      </Card>
      <div className="flex flex-col gap-2 lg:flex-row lg:justify-end">
        <Button onClick={onDone} className="lg:px-10">Empezar</Button>
      </div>
    </div>
  )
}
