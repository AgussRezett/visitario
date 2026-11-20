import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Position } from '@/domain/tracking'

/** Every position of a workday, oldest first (a long day is some hundreds). */
export const dayPositionsQuery = (workdayId: string) =>
  queryOptions({
    queryKey: ['tracking', 'day', workdayId],
    queryFn: async (): Promise<Position[]> => {
      const { data, error } = await supabase
        .from('workday_position')
        .select('device_id, lat, lng, accuracy, recorded_at')
        .eq('workday_id', workdayId)
        .order('recorded_at')
        .limit(3000)
      if (error) throw error
      return data.map((r) => ({ device: r.device_id, lat: r.lat, lng: r.lng, accuracy: r.accuracy, at: r.recorded_at }))
    },
    // Live while the page is open; the phone sends every 10 to 30 s.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

export async function sharePosition(workdayId: string, device: string, p: { lat: number; lng: number; accuracy: number }) {
  const { error } = await supabase.rpc('share_day_position', { p_workday: workdayId, p_device: device, p_lat: p.lat, p_lng: p.lng, p_accuracy: p.accuracy })
  if (error) throw error
}
