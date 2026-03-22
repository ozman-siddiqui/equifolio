import { useState } from 'react'
import { supabase } from '../supabase'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react'

const RECOMMENDATION_CONFIG = {
  BUY: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-600',
    icon: TrendingUp,
  },
  HOLD: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-500',
    icon: Minus,
  },
  SELL: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-600',
    icon: TrendingDown,
  },
}

export default function AIInlineScore({
  property,
  loans,
  transactions,
  onOpenDetail,
}) {
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const safeLoans = loans || []
  const safeTransactions = transactions || []

  const handleScore = async () => {
    if (score) return

    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch(
        'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/ai-score-property',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            property,
            loans: safeLoans,
            transactions: safeTransactions,
          }),
        }
      )

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setScore(data)
    } catch (err) {
      setError('Failed to get AI score.')
    } finally {
      setLoading(false)
    }
  }

  if (!score) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleScore}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-primary-50 hover:border-primary-200 text-primary-600 transition-colors disabled:opacity-70"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Get AI Score
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenDetail}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors"
          >
            Full AI view
            <ChevronRight size={13} />
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    )
  }

  const config = RECOMMENDATION_CONFIG[score.recommendation]
  const Icon = config?.icon || Sparkles

  return (
    <div className="mt-4 pt-4 border-t border-gray-50">
      <div
        className={`rounded-xl border px-3 py-3 ${config.bg} ${config.border}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon size={14} className={config.color} />
              <span className={`text-xs font-bold ${config.color}`}>
                {score.recommendation}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded text-white font-bold ${config.badge}`}
              >
                {score.score}/10
              </span>
            </div>

            <p className="text-xs text-gray-600 mt-2 line-clamp-2">
              {score.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setScore(null)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white transition-colors"
              title="Re-analyse"
            >
              <RefreshCcw size={13} />
            </button>

            <button
              type="button"
              onClick={onOpenDetail}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Details
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}