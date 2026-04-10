import { ArrowRight } from 'lucide-react'

export default function OpportunityCard({
  rank,
  title,
  impact,
  category,
  confidence,
  description,
  onExplore,
}) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          {rank ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              #{rank}
            </p>
          ) : null}
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-primary-700">{impact}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
          {category}
        </span>
      </div>

      {description ? (
        <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Confidence {confidence}
        </p>
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
