import { Lock } from 'lucide-react'

export default function SetupProgress({ state, onOpenSection }) {
  return (
    <section className="mt-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Setup Progress
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">
            {state.setupCompletionLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {state.stage === 5
              ? 'All five setup steps are complete. Portfolio, borrowing, and monthly-position insights are fully unlocked.'
              : state.stage === 4
                ? 'Core modules are complete. Finish Cash Flow to unlock your true monthly position and complete the dashboard.'
              : 'Complete the missing modules below to unlock deeper equity, borrowing, and action intelligence.'}
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${state.setupCompletionPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {state.setupChecklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.unlocked === false) return
              onOpenSection(item.route)
            }}
            disabled={item.unlocked === false}
            title={item.unlocked === false ? item.lockedReason : undefined}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
              item.unlocked === false
                ? 'cursor-not-allowed border-gray-100 bg-gray-50/50 opacity-70'
                : item.complete
                ? 'border-green-100 bg-green-50/70'
                : item.id === 'cashflow'
                  ? 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
                : 'border-gray-100 bg-gray-50/70 hover:bg-gray-50'
            }`}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              {item.label}
              {item.unlocked === false ? <Lock size={11} /> : null}
            </p>
            <p
              className={`mt-2 text-base font-semibold ${
                item.unlocked === false
                  ? 'text-gray-500'
                  : item.complete
                  ? 'text-green-700'
                  : item.id === 'cashflow'
                    ? 'text-amber-700'
                    : 'text-gray-900'
              }`}
            >
              {item.unlocked === false
                ? 'Locked'
                : item.complete ? 'Complete' : item.id === 'cashflow' ? 'Required' : 'Missing'}
            </p>
            {item.unlocked === false && item.lockedReason ? (
              <p className="mt-2 text-xs leading-5 text-gray-500">{item.lockedReason}</p>
            ) : null}
            {item.id === 'cashflow' ? (
              <p className="mt-2 text-xs leading-5 text-amber-800/80">
                Owner-occupied property costs are included in living expenses.
              </p>
            ) : null}
          </button>
        ))}
      </div>

      {state.liabilitiesLimitation ? (
        <p className="mt-4 text-sm text-gray-500">{state.liabilitiesLimitation}</p>
      ) : null}
    </section>
  )
}
