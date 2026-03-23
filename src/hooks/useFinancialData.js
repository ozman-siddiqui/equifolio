import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

async function fetchFinancialSnapshot() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      financialProfile: null,
      liabilities: [],
    }
  }

  const [
    { data: profile, error: profileError },
    { data: liabilityRows, error: liabilitiesError },
  ] = await Promise.all([
    supabase
      .from('user_financial_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('liabilities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (profileError || liabilitiesError) {
    throw profileError || liabilitiesError
  }

  return {
    financialProfile: profile || null,
    liabilities: liabilityRows || [],
  }
}

export default function useFinancialData() {
  const [financialProfile, setFinancialProfile] = useState(null)
  const [liabilities, setLiabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchFinancialData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const snapshot = await fetchFinancialSnapshot()
      setFinancialProfile(snapshot.financialProfile)
      setLiabilities(snapshot.liabilities)
    } catch (fetchError) {
      setFinancialProfile(null)
      setLiabilities([])
      setError(fetchError?.message || 'Financial data could not be loaded.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const snapshot = await fetchFinancialSnapshot()
        if (!active) return
        setFinancialProfile(snapshot.financialProfile)
        setLiabilities(snapshot.liabilities)
        setError('')
      } catch (fetchError) {
        if (!active) return
        setFinancialProfile(null)
        setLiabilities([])
        setError(fetchError?.message || 'Financial data could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  return {
    financialProfile,
    liabilities,
    loading,
    error,
    fetchFinancialData,
  }
}
