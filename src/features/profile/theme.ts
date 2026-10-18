import { readLocal, writeLocal } from '@/lib/storage'

export type ThemeChoice = 'light' | 'dark' | 'auto'
const KEY = 'visitario.theme'

export function getThemeChoice(): ThemeChoice {
  const v = readLocal(KEY)
  return v === 'light' || v === 'dark' ? v : 'auto'
}

export function applyTheme(choice: ThemeChoice = getThemeChoice()) {
  const dark = choice === 'dark' || (choice === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  paintSystemBar()
}

/**
 * The phone's status bar takes the page's ground, so it reads as part of the header. Read
 * from the CSS token, which stays the only place the color is written.
 */
function paintSystemBar() {
  const ground = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim()
  if (ground) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground)
}

export function setThemeChoice(choice: ThemeChoice) {
  writeLocal(KEY, choice === 'auto' ? null : choice)
  applyTheme(choice)
}
