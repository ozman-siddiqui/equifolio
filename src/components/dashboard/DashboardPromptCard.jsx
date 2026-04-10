import { ArrowRight } from 'lucide-react'

export default function DashboardPromptCard({
  eyebrow,
  title,
  body,
  ctaLabel,
  onAction,
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-4 text-sm leading-6 text-gray-600">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
      >
        {ctaLabel}
        <ArrowRight size={15} />
      </button>
    </section>
  )
}
