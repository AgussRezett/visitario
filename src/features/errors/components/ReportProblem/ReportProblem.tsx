import { useState } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { ReportForm } from '@/features/errors/components/ReportForm'

/** "Reportar un problema": anyone can write to Visitario about something that went wrong. */
export function ReportProblem({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" size="md" className={className} onClick={() => setOpen(true)}>
        <MessageSquareWarning size={18} aria-hidden />
        Reportar un problema
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reportar un problema" subtitle="Le llega al equipo de Visitario, con la pantalla y la versión de la app.">
        <ReportForm kind="manual" />
      </Sheet>
    </>
  )
}
