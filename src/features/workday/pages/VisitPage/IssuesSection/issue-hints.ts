/** What to write for each usual kind of novedad (the admin may rename them: then the generic one). */
export function issueHint(typeName: string): string {
  const t = typeName.toLowerCase()
  if (t.includes('pedido')) return 'Ej.: 2 cajas de SKYY 750 y 1 de Aperol'
  if (t.includes('stock')) return 'Ej.: no hay Campari 1 L desde la semana pasada'
  if (t.includes('precio')) return 'Ej.: el SKYY 750 sin precio en la góndola'
  if (t.includes('ubicad')) return 'Ej.: SKYY quedó al lado de New Style'
  if (t.includes('competencia')) return 'Ej.: Fernet Branca con exhibidor nuevo en la entrada'
  if (t.includes('cerrado')) return 'Ej.: cerrado por vacaciones hasta el 15'
  return 'Contale al supervisor qué pasa'
}
