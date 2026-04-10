import { create } from 'zustand'
import { supabase } from '../supabase'

let financialFetchPromise = null

async function fetchFinancialProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user?.id) {
    return null
  }

  const { data, error } = await supabase
    .from('user_financial_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

async function fetchLiabilities() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user?.id) {
    return []
  }

  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

export const useFinancialDataStore = create((set, get) => ({
  financialProfile: null,
  liabilities: [],
  loading: false,
  error: '',
  hasLoaded: false,
  async fetchFinancialData({ force = false } = {}) {
    if (financialFetchPromise && !force) {
      return financialFetchPromise
    }
    if (financialFetchPromise && force) {
      financialFetchPromise = null
    }

    const { hasLoaded } = get()
    if (hasLoaded && !force) {
      return {
        financialProfile: get().financialProfile,
        liabilities: get().liabilities,
      }
    }

    set((state) => ({
      ...state,
      loading: true,
      error: '',
    }))

    financialFetchPromise = Promise.allSettled([fetchFinancialProfile(), fetchLiabilities()])
      .then(([profileResult, liabilitiesResult]) => {
        if (profileResult.status === 'rejected') {
          throw profileResult.reason
        }

        const nextProfile = profileResult.value || null
        const nextLiabilities =
          liabilitiesResult.status === 'fulfilled' ? liabilitiesResult.value || [] : []

        set((state) => ({
          ...state,
          financialProfile: nextProfile,
          liabilities: nextLiabilities,
          loading: false,
          error: '',
          hasLoaded: true,
        }))

        return {
          financialProfile: nextProfile,
          liabilities: nextLiabilities,
        }
      })
      .catch((fetchError) => {
        set((state) => ({
          ...state,
          financialProfile: null,
          liabilities: [],
          loading: false,
          error: fetchError?.message || 'Financial profile could not be loaded.',
        }))
        throw fetchError
      })
      .finally(() => {
        financialFetchPromise = null
      })

    return financialFetchPromise
  },
  async refreshFinancialData() {
    return get().fetchFinancialData({ force: true })
  },
}))
