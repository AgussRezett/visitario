import { Hammer } from 'lucide-react'
import { Card } from '@/ui/Card'
import type { Section } from '@/features/shell/sections'
import styles from './ComingSoonPage.module.scss'

/** Placeholder for a section that arrives in a later stage. */
export function ComingSoonPage({ section }: { section: Section }) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{section.title}</h1>
      <Card className={styles.card}>
        <span className={styles.icon}>
          <Hammer size={20} aria-hidden />
        </span>
        <div className={styles.text}>
          <p className={styles.stage}>Llega en la etapa {section.stage}</p>
          <p className={styles.summary}>{section.summary}</p>
        </div>
      </Card>
    </div>
  )
}
