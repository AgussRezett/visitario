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
}

export function setThemeChoice(choice: ThemeChoice) {
  writeLocal(KEY, choice === 'auto' ? null : choice)
  applyTheme(choice)
}
