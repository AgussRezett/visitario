// How stores are written: the same rule as private.tidy_text in the database, which
// applies it to every store saved. Here it only makes the review show what will be saved.
//   "MANUELA PEDRAZA 3526" → "Manuela Pedraza 3526"
//   "SOLDADO DE LA INDEPENDENCIA" → "Soldado de la Independencia"

const LOWER = new Set(['de', 'del', 'y', 'e'])
const ARTICLES = new Set(['la', 'las', 'los', 'el'])

/** Upper case at the start of each run of letters, like Postgres initcap: O'Higgins, Av. */
const initcap = (w: string) => w.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())

export function tidyText(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words
    .map((w, i) => {
      const lower = w.toLowerCase()
      const prev = (words[i - 1] ?? '').toLowerCase()
      if (/[0-9]/.test(w)) return w // 3526, 4B, 2do
      if (/^([a-z]\.){2,}$/i.test(w) || /^[ivx]{1,6}$/i.test(w)) return w.toUpperCase() // S.A., XXIII
      if (i > 0 && (LOWER.has(lower) || (ARTICLES.has(lower) && (prev === 'de' || prev === 'a')))) return lower
      return initcap(w)
    })
    .join(' ')
}
