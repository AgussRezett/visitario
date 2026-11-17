/** What to say after reading captures: how many stores, and the rows AI could not read. */
export function readNote(stores: number, unreadable: number): string {
  const missed = unreadable ? ` No pudo leer ${unreadable === 1 ? '1 fila: sumala' : `${unreadable} filas: sumalas`} a mano.` : ''
  return `Leímos ${stores} ${stores === 1 ? 'local' : 'locales'}: revisalos contra los archivos antes de agregar.${missed}`
}
