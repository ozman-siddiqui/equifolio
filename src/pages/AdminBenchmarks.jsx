import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Shield, SlidersHorizontal, TrendingDown, TrendingUp, Minus, Zap } from 'lucide-react'

import { supabase } from '../supabase'

const BENCHMARK_ROWS = [
  {
    key: 'investor|Principal and Interest|<=80',
    occupancy_type: 'investor',
    repayment_type: 'Principal and Interest',
    lvr_band: '<=80',
    label: 'Investor - Principal and Interest <=80%',
  },
  {
    key: 'investor|Interest Only|<=80',
    occupancy_type: 'investor',
    repayment_type: 'Interest Only',
    lvr_band: '<=80',
    label: 'Investor - Interest Only <=80%',
  },
  {
    key: 'owner_occupier|Principal and Interest|<=80',
    occupancy_type: 'owner_occupier',
    repayment_type: 'Principal and Interest',
    lvr_band: '<=80',
    label: 'Owner Occupier - Principal and Interest <=80%',
  },
  {
    key: 'owner_occupier|Interest Only|<=80',
    occupancy_type: 'owner_occupier',
    repayment_type: 'Interest Only',
    lvr_band: '<=80',
    label: 'Owner Occupier - Interest Only <=80%',
  },
]

function buildKey(row) {
  return `${row.occupancy_type}|${row.repayment_type}|${row.lvr_band}`
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function AdminBenchmarks({ session = null }) {
  const adminEmail = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim()
  const userEmail = String(session?.user?.email || '').trim()
  const isAdmin = Boolean(adminEmail) && userEmail === adminEmail

  const [formValues, setFormValues] = useState(() =>
    Object.fromEntries(BENCHMARK_ROWS.map((row) => [row.key, '']))
  )
  const [effectiveDates, setEffectiveDates] = useState(() =>
    Object.fromEntries(BENCHMARK_ROWS.map((row) => [row.key, '']))
  )
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [rbaNewRate, setRbaNewRate] = useState('')
  const [rbaDecisionType, setRbaDecisionType] = useState('cut')
  const [rbaSaving, setRbaSaving] = useState(false)
  const [rbaSuccess, setRbaSuccess] = useState(false)
  const [rbaError, setRbaError] = useState(null)
  const [lastRateEvent, setLastRateEvent] = useState(null)

  const orderedRows = useMemo(() => BENCHMARK_ROWS, [])

  useEffect(() => {
    if (!isAdmin) return undefined

    let isMounted = true

    const fetchBenchmarks = async () => {
      setLoading(true)
      setLoadError('')

      const { data, error } = await supabase
        .from('market_rate_benchmarks')
        .select('occupancy_type, repayment_type, lvr_band, benchmark_rate, effective_date')

      if (!isMounted) return

      if (error) {
        setLoadError('Unable to load benchmark rates right now.')
        setLoading(false)
        return
      }

      const nextValues = Object.fromEntries(BENCHMARK_ROWS.map((row) => [row.key, '']))
      const nextDates = Object.fromEntries(BENCHMARK_ROWS.map((row) => [row.key, '']))

      for (const row of data || []) {
        const key = buildKey(row)
        nextValues[key] =
          row.benchmark_rate === null || row.benchmark_rate === undefined
            ? ''
            : String(row.benchmark_rate)
        nextDates[key] = row.effective_date || ''
      }

      setFormValues(nextValues)
      setEffectiveDates(nextDates)
      setLoading(false)
    }

    fetchBenchmarks()

    return () => {
      isMounted = false
    }
  }, [isAdmin])

  useEffect(() => {
    async function loadLastRateEvent() {
      const { data } = await supabase
        .from('rate_events')
        .select('*')
        .order('announced_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setLastRateEvent(data)
    }
    loadLastRateEvent()
  }, [])

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const validate = () => {
    const nextErrors = {}

    for (const row of orderedRows) {
      const rawValue = String(formValues[row.key] || '').trim()
      const parsedValue = Number(rawValue)

      if (!rawValue || Number.isNaN(parsedValue) || parsedValue < 3 || parsedValue > 12) {
        nextErrors[row.key] = 'Enter a rate between 3.0 and 12.0'
      }
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (key, value) => {
    setFormValues((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setSaveMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    setSaveMessage('')
    setLoadError('')

    const payload = orderedRows.map((row) => ({
      occupancy_type: row.occupancy_type,
      repayment_type: row.repayment_type,
      lvr_band: row.lvr_band,
      benchmark_rate: Number(formValues[row.key]),
    }))

    const { data, error } = await supabase.functions.invoke('update-benchmarks', {
      body: { rows: payload },
    })

    if (error) {
      setLoadError('Unable to update benchmark rates right now.')
      setSaving(false)
      return
    }

    const updatedRows = Array.isArray(data?.rows) ? data.rows : []
    if (updatedRows.length) {
      const nextDates = { ...effectiveDates }
      for (const row of updatedRows) {
        nextDates[buildKey(row)] = row.effective_date || ''
      }
      setEffectiveDates(nextDates)
    }

    setSaveMessage('Benchmark rates updated successfully.')
    setSaving(false)
  }

  async function handleRbaSubmit(e) {
    e.preventDefault()
    setRbaError(null)
    setRbaSuccess(false)

    const newRate = parseFloat(rbaNewRate)
    if (!rbaNewRate || isNaN(newRate) || newRate <= 0 || newRate > 20) {
      setRbaError('Enter a valid cash rate between 0 and 20%')
      return
    }

    const previousRate = lastRateEvent?.new_rate ?? 4.10

    setRbaSaving(true)
    try {
      await supabase
        .from('rate_events')
        .update({ is_active: false })
        .eq('is_active', true)

      const { data, error } = await supabase
        .from('rate_events')
        .insert({
          previous_rate: previousRate,
          new_rate: newRate,
          decision_type: rbaDecisionType,
          is_active: true,
          created_by: session?.user?.email,
        })
        .select()
        .single()

      if (error) throw error

      setRbaSuccess(true)
      setRbaNewRate('')
      setLastRateEvent(data)

      // Trigger portfolio impact computation for all users
    } catch (err) {
      setRbaError(err.message || 'Failed to record rate event')
    } finally {
      setRbaSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <Zap size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              RBA Rate Decision
            </h2>
            <p className="text-sm text-slate-500">
              Record a new RBA cash rate decision to trigger
              portfolio impact calculations for all users.
            </p>
          </div>
        </div>

        {lastRateEvent && (
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Last event: {lastRateEvent.decision_type} to{' '}
            <strong>{lastRateEvent.new_rate}%</strong> on{' '}
            {new Date(lastRateEvent.announced_at).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}
          </div>
        )}

        <form onSubmit={handleRbaSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New cash rate (%)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="20"
                value={rbaNewRate}
                onChange={e => setRbaNewRate(e.target.value)}
                placeholder="e.g. 3.85"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Decision type
              </label>
              <select
                value={rbaDecisionType}
                onChange={e => setRbaDecisionType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="cut">Cut</option>
                <option value="hike">Hike</option>
                <option value="hold">Hold</option>
              </select>
            </div>
          </div>

          {rbaError && (
            <p className="text-sm text-rose-600">{rbaError}</p>
          )}

          {rbaSuccess && (
            <p className="text-sm text-emerald-600 font-medium">
              Rate event recorded successfully. Portfolio impacts
              will be computed shortly.
            </p>
          )}

          <button
            type="submit"
            disabled={rbaSaving || !rbaNewRate}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={15} />
            {rbaSaving ? 'Recording...' : 'Record RBA Decision'}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary-600" />
            <h1 className="text-lg font-semibold text-gray-900">Benchmark Rate Admin</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Update the market benchmark rates used by the refinance opportunity engine.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {loading ? (
            <div className="text-sm text-gray-500">Loading benchmark rates...</div>
          ) : (
            orderedRows.map((row) => (
              <div key={row.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <label className="block text-sm font-medium text-gray-800">{row.label}</label>
                <div className="mt-3 max-w-xs">
                  <div className="relative">
                    <SlidersHorizontal
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="number"
                      min="3"
                      max="12"
                      step="0.01"
                      value={formValues[row.key]}
                      onChange={(event) => handleChange(row.key, event.target.value)}
                      className={`w-full rounded-xl border bg-white py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition ${
                        fieldErrors[row.key]
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-gray-200 focus:border-primary-400'
                      }`}
                    />
                  </div>
                  {fieldErrors[row.key] ? (
                    <p className="mt-2 text-xs text-red-600">{fieldErrors[row.key]}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-500">
                    Last updated: {formatDate(effectiveDates[row.key])}
                  </p>
                </div>
              </div>
            ))
          )}

          {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
          {saveMessage ? <p className="text-sm text-green-600">{saveMessage}</p> : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || saving}
              className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
            >
              {saving ? 'Updating...' : 'Update Rates'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
