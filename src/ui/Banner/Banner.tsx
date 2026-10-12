import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'ok' | 'warn' | 'error'

const tones: Record<Tone, string> = {
  info: 'bg-active-soft text-active-ink',
  ok: 'bg-done-soft text-done-ink',
  warn: 'bg-closed-soft text-closed-ink',
  error: 'bg-refused-soft text-refused-ink',
}

export function Banner({ tone = 'info', title, children, icon }: { tone?: Tone; title?: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md px-3.5 py-3 text-label', tones[tone])}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        {title ? <p className="font-extrabold">{title}</p> : null}
        {children ? <div className="font-semibold">{children}</div> : null}
      </div>
    </div>
  )
}
