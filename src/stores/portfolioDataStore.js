import { create } from 'zustand'
import { supabase } from '../supabase'

let portfolioFetchPromise = null
let portfolioFetchUserId = null

export const usePortfolioDataStore = create((set, get) => ({
  properties: [],
  loans: [],
  transactions: [],
  loading: false,
  error: '',
  hasLoaded: false,
  currentUserId: null,
  async fetchData({ force = false, userId = null } = {}) {
    if (!userId) {
      portfolioFetchPromise = null
      portfolioFetchUserId = null
      set((state) => ({
        ...state,
        properties: [],
        loans: [],
        transactions: [],
        loading: false,
        error: '',
        hasLoaded: false,
        currentUserId: null,
      }))

      return {
        properties: [],
        loans: [],
        transactions: [],
      }
    }

    if (portfolioFetchPromise && portfolioFetchUserId === userId) {
      return portfolioFetchPromise
    }

    const { hasLoaded, currentUserId } = get()
    if (hasLoaded && !force && currentUserId === userId) {
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
      currentUserId: userId,
    }))

    portfolioFetchUserId = userId
    portfolioFetchPromise = Promise.all([
      supabase
        .from('properties')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('loans')
        .select('*')
        .eq('user_id', userId),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
    ])
      .then(([{ data: props, error: propertiesError }, { data: lns, error: loansError }, { data: txns, error: transactionsError }]) => {
        const fetchError = propertiesError || loansError || transactionsError

        if (fetchError) {
          throw fetchError
        }

        if (get().currentUserId !== userId) {
          return {
            properties: get().properties,
            loans: get().loans,
            transactions: get().transactions,
          }
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
          currentUserId: userId,
        }))

        return nextState
      })
      .catch((fetchError) => {
        if (get().currentUserId !== userId) {
          throw fetchError
        }

        set((state) => ({
          ...state,
          loading: false,
          error: fetchError?.message || 'Portfolio data could not be loaded.',
        }))
        throw fetchError
      })
      .finally(() => {
        if (portfolioFetchUserId === userId) {
          portfolioFetchPromise = null
          portfolioFetchUserId = null
        }
      })

    return portfolioFetchPromise
  },
  async refreshData({ userId = null } = {}) {
    return get().fetchData({ force: true, userId: userId ?? get().currentUserId })
  },
}))
