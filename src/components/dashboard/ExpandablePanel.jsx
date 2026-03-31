import { ChevronDown } from 'lucide-react'

export default function ExpandablePanel({ title, subtitle = '', children }) {
  return (
    <details className="group rounded-[18px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-[rgba(16,92,75,0.16)] hover:bg-[rgba(248,251,249,0.96)] open:border-[rgba(16,92,75,0.18)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-[12px] transition-colors">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle ? <p className="mt-1.5 text-sm leading-6 text-gray-500">{subtitle}</p> : null}
        </div>
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(0,0,0,0.06)] bg-gray-50/80 text-gray-400 transition-all duration-200 group-hover:border-[rgba(16,92,75,0.16)] group-hover:text-primary-700 group-open:rotate-180">
          <ChevronDown size={18} />
        </span>
      </summary>

      <div className="mt-5 border-t border-[rgba(0,0,0,0.06)] pt-5">{children}</div>
    </details>
  )
}
