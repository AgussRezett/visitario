import { Hammer } from 'lucide-react'
import { Card } from '@/ui/Card'
import type { Section } from './sections'

export function ComingSoon({ section }: { section: Section }) {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4 lg:px-8 lg:pt-8">
      <h1 className="text-display font-extrabold tracking-tight">{section.title}</h1>
      <Card className="max-w-xl flex-row items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-forest dark:text-lime">
          <Hammer size={20} aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-bold">Llega en la etapa {section.stage}</p>
          <p className="text-label text-ink-muted">{section.summary}</p>
        </div>
      </Card>
    </div>
  )
}
