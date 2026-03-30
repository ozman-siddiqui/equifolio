import { useEffect } from 'react'
import { usePortfolioDataStore } from '../stores/portfolioDataStore'

export default function usePortfolioData() {
  const properties = usePortfolioDataStore((state) => state.properties)
  const loans = usePortfolioDataStore((state) => state.loans)
  const transactions = usePortfolioDataStore((state) => state.transactions)
  const loading = usePortfolioDataStore((state) => state.loading)
  const error = usePortfolioDataStore((state) => state.error)
  const hasLoaded = usePortfolioDataStore((state) => state.hasLoaded)
  const fetchData = usePortfolioDataStore((state) => state.fetchData)
  const refreshData = usePortfolioDataStore((state) => state.refreshData)

  useEffect(() => {
    if (hasLoaded || loading) return
    fetchData().catch(() => {})
  }, [fetchData, hasLoaded, loading])

  return {
    properties,
    loans,
    transactions,
    loading,
    error,
    fetchData,
    refreshData,
  }
}
