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
  const accentClasses = featured
    ? {
        article:
          'border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,248,0.86),rgba(255,255,255,1))] before:bg-emerald-500 hover:border-emerald-300',
        badge: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
        label: 'text-emerald-700',
        chip: 'border border-emerald-200 bg-emerald-50/90 text-emerald-800',
      }
    : {
        article:
          'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,1))] before:bg-amber-400 hover:border-amber-300',
        badge: 'border border-amber-200 bg-amber-50 text-amber-800',
        label: 'text-amber-700',
        chip: 'border border-amber-200 bg-amber-50/90 text-amber-800',
      }

  return (
    <article
      className={`relative flex min-h-[264px] flex-col overflow-hidden rounded-[16px] border-[0.5px] p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 ${accentClasses.article}`}
    >
      <div className="relative grid min-h-[32px] grid-cols-[auto,minmax(0,1fr)] items-start gap-4">
        <div
          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold tracking-[0.18em] ${accentClasses.badge}`}
        >
          #{rank}
        </div>
        <div className="justify-self-end max-w-[180px] text-right">
          {sequenceLabel ? (
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${accentClasses.label}`}>
              {sequenceLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 flex min-h-[76px] flex-col justify-start">
        <h3
          className="text-[19px] font-semibold leading-7 tracking-[-0.02em] text-gray-900 break-words"
          style={clamp(2)}
        >
          {title}
        </h3>
      </div>

      <div className="relative mt-4 flex min-h-[74px] flex-wrap gap-2">
        {borrowingImpact ? (
          <p
            className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold break-words ${accentClasses.chip}`}
            style={clamp(2)}
          >
            {borrowingImpact}
          </p>
        ) : impact ? (
          <p
            className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold break-words ${accentClasses.chip}`}
            style={clamp(2)}
          >
            {impact}
          </p>
        ) : null}
        {monthlyImpact ? (
          <p
            className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 break-words"
            style={clamp(2)}
          >
            {monthlyImpact}
          </p>
        ) : null}
        {yearlyImpact ? (
          <p
            className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 break-words"
            style={clamp(2)}
          >
            {yearlyImpact}
          </p>
        ) : null}
      </div>

      <div className="relative mt-4 min-h-[72px]">
        {rankReason ? (
          <p
            className="text-sm font-medium leading-6 text-gray-900 break-words"
            style={clamp(2)}
          >
            {rankReason}
          </p>
        ) : null}
        <p
          className={`${rankReason ? 'mt-2' : ''} text-sm leading-6 text-gray-600 break-words`}
          style={clamp(2)}
        >
          {explanation}
        </p>
      </div>

      <div className="relative mt-auto pt-6">
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
