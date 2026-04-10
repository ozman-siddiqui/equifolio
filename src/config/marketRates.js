// Canonical market rate config for Vaulta.
// Single source of truth for all rate values.
// MVP: static export. Epic 7.3 upgrade: replace with Supabase fetch.
// Used by: stressThreshold, RBA Impact Engine, Refinance Watch.

import { supabase } from '../supabase'

export const CURRENT_CASH_RATE = 4.10
export const DEFAULT_ASSESSMENT_RATE = 8.50
export const STRESS_HEADROOM_BUFFER = 1.50

export async function fetchCurrentCashRate() {
  try {
    const { data } = await supabase
      .from('rate_events')
      .select('new_rate')
      .eq('is_active', true)
      .order('announced_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Number(data?.new_rate ?? CURRENT_CASH_RATE)
  } catch {
    return CURRENT_CASH_RATE
  }
}
