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
          'border-[1.5px] border-[#6EE7B7] bg-[#F0FDF9] before:bg-[#19C37D] hover:border-[#6EE7B7]',
        badge: 'bg-[#DCEFE5] text-[#085041]',
        priority: 'bg-[#DCEFE5] text-[#085041] font-bold',
        chip: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
        chipFill: 'bg-[#DCEFE5] text-[#085041] font-semibold',
        explore: 'text-[#19C37D] hover:text-[#0F6E56]',
      }
    : {
        article:
          'border-[1.5px] border-[#FCD34D] bg-[#FFFBEB] before:bg-[#F59E0B] hover:border-[#FCD34D]',
        badge: 'bg-[#FEF3C7] text-[#92400E]',
        priority: 'bg-[#FEF3C7] text-[#92400E] font-bold',
        chip: 'border border-amber-200 bg-amber-50 text-amber-800',
        chipFill: 'bg-[#FEF3C7] text-[#92400E] font-semibold',
        explore: 'text-[#D97706] hover:text-[#B45309]',
      }

  return (
    <article
      className={`relative flex min-h-[264px] flex-col overflow-hidden rounded-[16px] p-7 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_6px_20px_rgba(15,23,42,0.08)] transition-[transform,border-color,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 ${accentClasses.article}`}
    >
      <div className="relative grid min-h-[32px] grid-cols-[auto,minmax(0,1fr)] items-start gap-4">
        <div
          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] px-2 text-[9px] font-bold tracking-[0.08em] ${accentClasses.badge}`}
        >
          #{rank}
        </div>
        <div className="justify-self-end max-w-[180px] text-right">
          <p className={`inline-flex items-center rounded-[6px] px-3 py-1 text-[9px] font-bold tracking-[0.08em] ${accentClasses.priority}`}>
            {featured ? 'Start here' : 'Next priority'}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex min-h-[76px] flex-col justify-start">
        <h3
          className="text-[15px] font-bold leading-6 tracking-[-0.01em] text-[#0F172A] break-words"
          style={clamp(2)}
        >
          {title}
        </h3>
      </div>

      <div className="relative mt-4 min-h-[84px]">
        {rankReason ? (
          <p
          className="text-sm font-medium leading-6 text-[#0F172A] break-words"
          style={clamp(2)}
        >
          {rankReason}
        </p>
      ) : null}
      <p
          className={`${rankReason ? 'mt-2' : ''} text-[13px] leading-[1.6] text-slate-600 break-words`}
          style={clamp(2)}
        >
          {explanation}
        </p>
      </div>

      <div className="relative mt-4 flex min-h-[74px] flex-wrap items-start gap-2">
        {borrowingImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {borrowingImpact}
          </p>
        ) : impact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {impact}
          </p>
        ) : null}
        {monthlyImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold break-normal ${accentClasses.chipFill}`}
            style={clamp(2)}
          >
            {monthlyImpact}
          </p>
        ) : null}
        {yearlyImpact ? (
          <p
            className={`inline-flex h-auto w-fit min-w-0 max-w-max flex-none items-center justify-center whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold break-normal ${accentClasses.chipFill}`}
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
          className={`inline-flex items-center gap-2 text-[13px] font-semibold transition-colors ${accentClasses.explore}`}
        >
          Explore
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  )
}
