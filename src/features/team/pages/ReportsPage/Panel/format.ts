// How the reports panel writes numbers (es-AR): 1.234 · 82 % · +12 %.

export const num = (n: number, digits = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
export const pct = (n: number | null, digits = 0) => (n === null ? '—' : `${num(n * 100, digits)} %`)
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n * 100))} %`
export const minutesText = (m: number | null) => (m === null ? '—' : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`)
