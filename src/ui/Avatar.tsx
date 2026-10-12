import { cn } from '@/lib/cn'

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-forest font-extrabold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {name}
    </span>
  )
}
