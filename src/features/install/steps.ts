import { Ellipsis, EllipsisVertical, ExternalLink, Menu, Share, SquarePlus, type LucideIcon } from 'lucide-react'
import { androidBrowser, isIos, safariVersion, type InstallKind } from '@/domain/install'

/** One step: what to do, and the button to look for on the screen (icon and its name). */
export interface Step {
  text: string
  key?: { icon: LucideIcon; label: string }
}

const ADD_HOME = { icon: SquarePlus, label: 'Agregar a pantalla de inicio' }
const SHARE = { icon: Share, label: 'Compartir' }

/** The steps for this browser, in its own words (es-AR menus). */
export function stepsFor(kind: InstallKind, ua: string, touch: boolean): Step[] {
  switch (kind) {
    case 'ios-safari':
      // Safari 26 (iOS 26) hides Share inside the "···" menu next to the address bar.
      return (safariVersion(ua) ?? 0) >= 26
        ? [
            { text: 'Tocá los tres puntos, a la derecha de la barra de direcciones.', key: { icon: Ellipsis, label: 'Más' } },
            { text: 'Tocá Compartir.', key: SHARE },
            { text: 'Bajá y tocá Agregar a pantalla de inicio.', key: ADD_HOME },
            { text: 'Dejá activado “Abrir como app web” y tocá Agregar.' },
          ]
        : [
            { text: 'Tocá Compartir, el cuadrado con la flecha, abajo en el centro.', key: SHARE },
            { text: 'Bajá y tocá Agregar a pantalla de inicio.', key: ADD_HOME },
            { text: 'Tocá Agregar, arriba a la derecha.' },
          ]
    case 'ios-other':
      return [
        { text: 'Tocá Compartir, en la barra de direcciones o en el menú del navegador.', key: SHARE },
        { text: 'Tocá Agregar a pantalla de inicio. Si no aparece, copiá el enlace y abrilo en Safari.', key: ADD_HOME },
        { text: 'Tocá Agregar.' },
      ]
    case 'android-manual': {
      const browser = androidBrowser(ua)
      if (browser === 'samsung') {
        return [
          { text: 'Tocá el menú, abajo a la derecha.', key: { icon: Menu, label: 'Menú' } },
          { text: 'Tocá Agregar página a y elegí Pantalla de inicio.', key: { icon: SquarePlus, label: 'Agregar página a' } },
          { text: 'Confirmá con Agregar.' },
        ]
      }
      return [
        { text: 'Tocá el menú, arriba a la derecha. Si dice “Abrir en Chrome” (pasa al abrir el enlace desde WhatsApp), tocalo primero.', key: { icon: EllipsisVertical, label: 'Menú' } },
        { text: browser === 'firefox' ? 'Tocá Instalar o Agregar a pantalla de inicio.' : 'Tocá Instalar app o Agregar a la pantalla principal.', key: { icon: SquarePlus, label: browser === 'firefox' ? 'Instalar' : 'Instalar app' } },
        { text: 'Confirmá con Instalar.' },
      ]
    }
    case 'in-app':
      return isIos({ ua, touch })
        ? [
            { text: 'Tocá el menú de esta app (los tres puntos o el ícono de compartir).', key: { icon: Ellipsis, label: 'Más' } },
            { text: 'Elegí Abrir en Safari, o copiá el enlace y pegalo en Safari.', key: { icon: ExternalLink, label: 'Abrir en Safari' } },
            { text: 'En Safari, abrí esta misma guía desde tu perfil y seguí los pasos.' },
          ]
        : [
            { text: 'Tocá Abrir en Chrome, acá abajo (o copiá el enlace y pegalo en Chrome).', key: { icon: ExternalLink, label: 'Abrir en Chrome' } },
            { text: 'En Chrome te aparece la opción de instalar.' },
          ]
    case 'desktop-safari':
      return [
        { text: 'En la barra de menús de arriba, abrí Archivo.' },
        { text: 'Elegí Agregar al Dock y tocá Agregar.', key: { icon: SquarePlus, label: 'Agregar al Dock' } },
      ]
    default:
      return []
  }
}
