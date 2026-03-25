import { ChevronDown } from 'lucide-react'

export default function ExpandablePanel({ title, subtitle = '', children }) {
  return (
    <details className="group rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100/70">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-gray-500">{subtitle}</p> : null}
        </div>
        <ChevronDown size={18} className="mt-1 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-5">{children}</div>
    </details>
  )
}
