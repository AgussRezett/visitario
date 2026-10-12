import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Logo } from '@/ui/Logo'

const points = [
  'Activadores: la jornada en el celular, sin señal también.',
  'Supervisores: asignar, revisar y aprobar en un solo lugar.',
  'Administradores: equipos, catálogos y plan de la empresa.',
]

/** Login and sign-up frame: single column on phones, split panel on desktop (wireframes A01 / AD01). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="hidden flex-col justify-between gap-8 bg-forest px-12 py-14 text-white lg:flex lg:w-[42%]">
        <Logo size="lg" onDark />
        <div className="flex max-w-md flex-col gap-5">
          <p className="text-[34px] font-extrabold leading-10 tracking-tight">Tu jornada de campo, del recorrido al OK.</p>
          <ul className="flex flex-col gap-3 text-[#D6E4DC]">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-lime text-forest">
                  <Check size={16} strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-label text-[#A9BDB2]">Una sola cuenta para el celular y la computadora.</p>
      </aside>
      <main className="flex flex-1 justify-center px-5 py-10 lg:items-center lg:px-6">
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          <div className="lg:hidden">
            <Logo size="lg" />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
