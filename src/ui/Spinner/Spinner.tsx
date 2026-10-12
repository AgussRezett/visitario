export function FullScreenSpinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <span className="size-8 animate-spin rounded-full border-[3px] border-forest border-r-transparent dark:border-lime dark:border-r-transparent" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}
