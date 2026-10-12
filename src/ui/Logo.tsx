import { cn } from '@/lib/cn'

/** Visitario wordmark: the V with a lime square reads as a ticked box. */
export function Logo({ size = 'md', onDark = false, className }: { size?: 'md' | 'lg'; onDark?: boolean; className?: string }) {
  const mark = size === 'lg' ? 40 : 28
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-extrabold tracking-tight', size === 'lg' ? 'text-[34px]' : 'text-[22px]', className)}>
      <svg width={mark} height={mark} viewBox="0 0 32 32" aria-hidden>
        <path d="M3 5h6.5L16 22.5 22.5 5H29L19.2 28h-6.4z" fill={onDark ? '#F6F7F2' : 'currentColor'} className={onDark ? '' : 'text-forest dark:text-lime'} />
        <rect x="22.5" y="1" width="8" height="8" rx="2" fill="#B8D941" />
      </svg>
      <span className={onDark ? 'text-[#F6F7F2]' : 'text-forest dark:text-ink'}>isitario</span>
      <span className="sr-only">Visitario</span>
    </span>
  )
}
