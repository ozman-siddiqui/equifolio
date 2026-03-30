import { create } from 'zustand'
import { supabase } from '../supabase'

let portfolioFetchPromise = null

export const usePortfolioDataStore = create((set, get) => ({
  properties: [],
  loans: [],
  transactions: [],
  loading: false,
  error: '',
  hasLoaded: false,
  async fetchData({ force = false } = {}) {
    if (portfolioFetchPromise) {
      return portfolioFetchPromise
    }

    const { hasLoaded } = get()
    if (hasLoaded && !force) {
      return {
        properties: get().properties,
        loans: get().loans,
        transactions: get().transactions,
      }
    }

    set((state) => ({
      ...state,
      loading: true,
      error: '',
    }))

    portfolioFetchPromise = Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*'),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
    ])
      .then(([{ data: props, error: propertiesError }, { data: lns, error: loansError }, { data: txns, error: transactionsError }]) => {
        const fetchError = propertiesError || loansError || transactionsError

        if (fetchError) {
          throw fetchError
        }

        const nextState = {
          properties: props || [],
          loans: lns || [],
          transactions: txns || [],
        }

        set((state) => ({
          ...state,
          ...nextState,
          loading: false,
          error: '',
          hasLoaded: true,
        }))

        return nextState
      })
      .catch((fetchError) => {
        set((state) => ({
          ...state,
          loading: false,
          error: fetchError?.message || 'Portfolio data could not be loaded.',
        }))
        throw fetchError
      })
      .finally(() => {
        portfolioFetchPromise = null
      })

    return portfolioFetchPromise
  },
}))
