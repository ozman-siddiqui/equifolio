import { useState } from 'react'
import { supabase } from '../supabase'
import { Sparkles, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Lightbulb } from 'lucide-react'

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

export default function AIScorePanel({ property, loans, transactions }) {
  const [score, setScore] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const handleScore = async () => {
    if (score) {
      setExpanded(!expanded)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/ai-score-property',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ property, loans, transactions }),
        }
      )

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setScore(data)
      setExpanded(true)
    } catch (err) {
      setError('Failed to get AI score. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const config = score ? RECOMMENDATION_CONFIG[score.recommendation] : null
  const Icon = config?.icon

  return (
    <div className="mt-3">
      {/* Score button / collapsed view */}
      <button
        onClick={handleScore}
        disabled={loading}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
          score
            ? `${config.bg} ${config.border}`
            : 'bg-gray-50 border-gray-200 hover:bg-primary-50 hover:border-primary-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-primary-600 font-medium">Analysing with AI...</span>
            </>
          ) : score ? (
            <>
              <Icon size={14} className={config.color} />
              <span className={`text-xs font-bold ${config.color}`}>{score.recommendation}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded text-white font-bold ${config.badge}`}>
                {score.score}/10
              </span>
              <span className="text-xs text-gray-500 truncate max-w-[200px]">{score.summary}</span>
            </>
          ) : (
            <>
              <Sparkles size={13} className="text-primary-500" />
              <span className="text-xs text-primary-600 font-medium">Get AI Score</span>
              <span className="text-xs text-gray-400">· Buy / Hold / Sell analysis</span>
            </>
          )}
        </div>
        {score && (
          expanded
            ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
            : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-1 px-1">{error}</p>
      )}

      {/* Expanded panel */}
      {score && expanded && (
        <div className={`mt-2 p-4 rounded-lg border ${config.bg} ${config.border} space-y-3`}>

          {/* Reasons */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <TrendingUp size={12} /> Analysis
            </p>
            <ul className="space-y-1">
              {score.reasons.map((reason, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-gray-400 flex-shrink-0 mt-0.5">·</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Risks */}
          {score.risks?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" /> Risks
              </p>
              <ul className="space-y-1">
                {score.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-amber-400 flex-shrink-0 mt-0.5">·</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunity */}
          {score.opportunity && (
            <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-white">
              <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Lightbulb size={12} className="text-yellow-500" /> Opportunity
              </p>
              <p className="text-xs text-gray-600">{score.opportunity}</p>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => { setScore(null); setExpanded(false) }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Re-analyse
          </button>
        </div>
      )}
    </div>
  )
}