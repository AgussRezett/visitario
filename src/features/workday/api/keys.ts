/** Query keys of the merchandiser's day (and the catalogs, cached with it). */
export const workdayKeys = {
  all: ['workday'] as const,
  day: (companyId: string, date: string) => ['workday', 'day', companyId, date] as const,
  visits: (workdayId: string) => ['workday', 'visits', workdayId] as const,
  visit: (visitId: string) => ['workday', 'visit', visitId] as const,
  history: (companyId: string) => ['workday', 'history', companyId] as const,
  resumable: (companyId: string, date: string) => ['workday', 'resumable', companyId, date] as const,
  // 'tags': catalogs cached before channels and sellers existed are not reused
  catalogs: (companyId: string) => ['catalogs', companyId, 'tags'] as const,
}
