import { ChevronRight } from 'lucide-react'

function clamp(lines) {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
}

export default function ScenarioCard({
  label,
  title,
  priceRange,
  yieldText,
  metricText,
  rationale,
  onExplore,
}) {
  return (
    <article className="flex min-h-[360px] flex-col rounded-3xl border border-gray-100 bg-gray-50/70 p-5">
      <div className="min-h-[20px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
          {label}
        </p>
      </div>

      <div className="mt-3 min-h-[56px]">
        <h3 className="text-lg font-semibold leading-7 text-gray-900 break-words" style={clamp(2)}>
          {title}
        </h3>
      </div>

      <div className="mt-4 flex min-h-[72px] items-start">
        <p className="text-3xl font-bold tracking-tight text-gray-900 break-words" style={clamp(2)}>
          {priceRange}
        </p>
      </div>

      <div className="mt-3 min-h-[52px]">
        <p className="text-sm font-medium text-primary-700 break-words" style={clamp(1)}>
          {yieldText}
        </p>
        <p className="mt-1 text-sm font-medium text-gray-500 break-words" style={clamp(1)}>
          {metricText}
        </p>
      </div>

      <div className="mt-4 min-h-[72px]">
        <p className="text-sm leading-6 text-gray-600 break-words" style={clamp(3)}>
          {rationale}
        </p>
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          onClick={onExplore}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          Explore
          <ChevronRight size={15} />
        </button>
      </div>
    </article>
  )
}
