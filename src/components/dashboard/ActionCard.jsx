import { ArrowRight } from 'lucide-react'

function clamp(lines) {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
}

export default function ActionCard({
  rank,
  sequenceLabel = null,
  title,
  impact,
  monthlyImpact = null,
  yearlyImpact = null,
  borrowingImpact = null,
  rankReason = null,
  explanation,
  onExplore,
  featured = false,
}) {
  return (
    <article
      className={`flex min-h-[248px] flex-col rounded-3xl border p-5 ${
        featured ? 'border-primary-200 bg-primary-50/50' : 'border-gray-100 bg-gray-50/70'
      }`}
    >
      <div className="grid min-h-[24px] grid-cols-[auto,minmax(0,1fr)] items-start gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
          #{rank}
        </p>
        <div className="justify-self-end max-w-[160px] text-right">
          {sequenceLabel ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-600">
              {sequenceLabel}
            </p>
          ) : null}
          {borrowingImpact ? (
            <p
              className="mt-1 text-sm font-semibold text-primary-700 break-words"
              style={clamp(2)}
            >
              {borrowingImpact}
            </p>
          ) : impact ? (
            <p
              className="mt-1 text-sm font-semibold text-primary-700 break-words"
              style={clamp(2)}
            >
              {impact}
            </p>
          ) : null}
          {monthlyImpact ? (
            <p className="mt-1 text-xs font-medium text-gray-600 break-words" style={clamp(2)}>
              {monthlyImpact}
            </p>
          ) : null}
          {yearlyImpact ? (
            <p className="mt-1 text-xs font-medium text-gray-600 break-words" style={clamp(2)}>
              {yearlyImpact}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 min-h-[64px]">
        <h3 className="text-base font-semibold leading-7 text-gray-900 break-words" style={clamp(2)}>
          {title}
        </h3>
      </div>

      <div className="mt-3 min-h-[60px]">
        {rankReason ? (
          <p className="text-sm font-medium leading-6 text-gray-900 break-words" style={clamp(2)}>
            {rankReason}
          </p>
        ) : null}
        <p className="text-sm leading-6 text-gray-600 break-words" style={clamp(2)}>
          {explanation}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          Explore
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  )
}
