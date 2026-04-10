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
          'border-[0.5px] border-[rgba(29,158,117,0.22)] bg-[linear-gradient(180deg,rgba(240,253,248,0.86),rgba(255,255,255,1))] before:bg-[#1D9E75] hover:border-[rgba(29,158,117,0.36)] hover:before:bg-[#0F6E56]',
        badge: 'bg-[#d4f0e6] text-[#063d2e]',
        priority: 'bg-[#d4f0e6] text-[#063d2e]',
        chip: 'border border-emerald-200 bg-emerald-50/90 text-emerald-800',
        chipFill: 'bg-[#d4f0e6] text-[#063d2e]',
      }
    : {
        article:
          'border-[0.5px] border-[rgba(239,159,39,0.24)] bg-[linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,1))] before:bg-[#EF9F27] hover:border-[rgba(239,159,39,0.38)] hover:before:bg-[#BA7517]',
        badge: 'bg-[#fce8ce] text-[#5a3005]',
        priority: 'bg-[#fce8ce] text-[#5a3005]',
        chip: 'border border-amber-200 bg-amber-50/90 text-amber-800',
        chipFill: 'bg-[#fce8ce] text-[#5a3005]',
      }

  return (
    <article
      className={`relative flex min-h-[264px] flex-col overflow-hidden rounded-r-[16px] rounded-l-none p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-[transform,border-color,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 ${accentClasses.article}`}
    >
      <div className="relative grid min-h-[32px] grid-cols-[auto,minmax(0,1fr)] items-start gap-4">
        <div
          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${accentClasses.badge}`}
        >
          #{rank}
        </div>
        <div className="justify-self-end max-w-[180px] text-right">
          <p className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${accentClasses.priority}`}>
            {featured ? 'Start here' : 'Next priority'}
          </p>
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

      <div className="relative mt-4 min-h-[84px]">
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

      <div className="relative mt-4 flex min-h-[74px] flex-wrap items-start gap-2">
        {borrowingImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[999px] px-3 py-1 text-[11px] font-medium break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {borrowingImpact}
          </p>
        ) : impact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[999px] px-3 py-1 text-[11px] font-medium break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {impact}
          </p>
        ) : null}
        {monthlyImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[999px] px-3 py-1 text-[11px] font-medium break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {monthlyImpact}
          </p>
        ) : null}
        {yearlyImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[999px] px-3 py-1 text-[11px] font-medium break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {yearlyImpact}
          </p>
        ) : null}
      </div>

      <div className="relative mt-auto pt-5">
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
