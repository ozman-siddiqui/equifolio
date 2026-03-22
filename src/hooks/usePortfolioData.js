import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function usePortfolioData() {
  const [properties, setProperties] = useState([])
  const [loans, setLoans] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)

    const [{ data: props }, { data: lns }, { data: txns }] = await Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*'),
      supabase.from('transactions').select('*').order('date', { ascending: false }),
    ])

    setProperties(props || [])
    setLoans(lns || [])
    setTransactions(txns || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  return {
    properties,
    loans,
    transactions,
    loading,
    fetchData,
  }
}