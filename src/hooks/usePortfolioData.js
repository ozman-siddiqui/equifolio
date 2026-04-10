import { useEffect } from 'react'
import { usePortfolioDataStore } from '../stores/portfolioDataStore'

export function usePortfolioData(session = null) {
  const properties = usePortfolioDataStore((state) => state.properties)
  const loans = usePortfolioDataStore((state) => state.loans)
  const transactions = usePortfolioDataStore((state) => state.transactions)
  const loading = usePortfolioDataStore((state) => state.loading)
  const error = usePortfolioDataStore((state) => state.error)
  const fetchData = usePortfolioDataStore((state) => state.fetchData)
  const refreshData = usePortfolioDataStore((state) => state.refreshData)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      fetchData({ userId: null, force: true }).catch(() => {})
      return
    }

    fetchData({ userId, force: true }).catch(() => {})
  }, [fetchData, userId])

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

export default usePortfolioData
