import { describe, expect, it } from 'vitest'
import { buildDailyReport, reportTotals } from './report'

const template =
  'RESUMEN DEL DIA {date}\nCUANTOS CLIENTES VISITE: {visited_count}\n{metrics}\n\nVisitados:\n{visited}\n\nNo visitados:\n{not_visited}\n\nExtras:\n{added}'

const visits = [
  { address: 'Amenábar 1260', added: false, workStatus: 'done' as const },
  { address: 'Vidal 2044', added: false, workStatus: 'closed' as const },
  { address: 'Monroe 2650', added: false, workStatus: 'refused' as const },
  { address: 'Echeverría 1580', added: false, workStatus: 'pending' as const },
  { address: 'Cabildo 2280', added: true, workStatus: 'done' as const },
]

describe('daily report', () => {
  it('matches the WhatsApp format', () => {
    const text = buildDailyReport({
      date: '2026-10-09',
      visits,
      template,
      metrics: [
        { name: 'Unidades', reportLabel: null, total: 24 },
        { name: 'Kits de bolsas', reportLabel: 'CUANTOS KIT DE BOLSAS ARME', total: 10 },
        { name: 'Agrupaciones', reportLabel: 'CUANTAS AGRUPACIONES ARME', total: 7 },
      ],
    })
    expect(text).toBe(
      [
        'RESUMEN DEL DIA 09/10',
        'CUANTOS CLIENTES VISITE: 4',
        'CUANTOS KIT DE BOLSAS ARME: 10',
        'CUANTAS AGRUPACIONES ARME: 7',
        '',
        'Visitados:',
        'Amenábar 1260',
        'Vidal 2044 (cerrado)',
        'Monroe 2650 (no autorizó)',
        '',
        'No visitados:',
        'Echeverría 1580',
        '',
        'Extras:',
        'Cabildo 2280',
      ].join('\n'),
    )
  })

  it('closed and not authorized count as visited', () => {
    expect(reportTotals(visits)).toEqual({ visited: 4, extras: 1, notVisited: 1 })
  })

  it('counts the visited stores per channel', () => {
    const tagged = [
      { address: 'A', added: false, workStatus: 'done' as const, channel: 'Autoservicio' },
      { address: 'B', added: true, workStatus: 'done' as const, channel: 'Autoservicio' },
      { address: 'C', added: false, workStatus: 'closed' as const, channel: 'Kiosco' },
      { address: 'D', added: false, workStatus: 'done' as const, channel: null },
      { address: 'E', added: false, workStatus: 'pending' as const, channel: 'Kiosco' },
    ]
    expect(buildDailyReport({ date: '2026-10-09', visits: tagged, metrics: [], template: '{POR_CANAL}' })).toBe('AUTOSERVICIO: 2\nKIOSCO: 1\nSIN CANAL: 1')
    expect(buildDailyReport({ date: '2026-10-09', visits, metrics: [], template: 'X\nCanales:\n{por_canal}' })).toBe('X\nCanales:\n-')
  })

  it('shows a dash for empty lists', () => {
    expect(buildDailyReport({ date: '2026-10-09', visits: [], metrics: [], template })).toContain('Visitados:\n-')
  })
})
