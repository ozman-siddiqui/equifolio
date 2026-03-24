import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

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

export default function useFinancialData() {
  const [financialProfile, setFinancialProfile] = useState(null)
  const [liabilities, setLiabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchFinancialData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const profile = await fetchFinancialProfile()
      setFinancialProfile(profile)
    } catch (fetchError) {
      setFinancialProfile(null)
      setError(fetchError?.message || 'Financial profile could not be loaded.')
    }

    try {
      const nextLiabilities = await fetchLiabilities()
      setLiabilities(nextLiabilities)
    } catch {
      setLiabilities([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFinancialData()
  }, [fetchFinancialData])

  return {
    financialProfile,
    liabilities,
    loading,
    error,
    fetchFinancialData,
  }
}
