import { useEffect } from 'react'
import { useFinancialDataStore } from '../stores/financialDataStore'

export default function useFinancialData() {
  const financialProfile = useFinancialDataStore((state) => state.financialProfile)
  const liabilities = useFinancialDataStore((state) => state.liabilities)
  const loading = useFinancialDataStore((state) => state.loading)
  const error = useFinancialDataStore((state) => state.error)
  const hasLoaded = useFinancialDataStore((state) => state.hasLoaded)
  const fetchFinancialData = useFinancialDataStore((state) => state.fetchFinancialData)
  const refreshFinancialData = useFinancialDataStore((state) => state.refreshFinancialData)

  useEffect(() => {
    if (hasLoaded || loading) return
    fetchFinancialData().catch(() => {})
  }, [fetchFinancialData, hasLoaded, loading])

  return {
    financialProfile,
    liabilities,
    loading,
    error,
    fetchFinancialData,
    refreshFinancialData,
  }
}
