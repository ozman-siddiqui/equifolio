export const utilityPrimaryButtonClass =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap leading-none min-w-fit h-10 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm shadow-primary-100/80 transition-colors'

export const utilityInlinePrimaryButtonClass =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap leading-none min-w-fit h-9 px-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm shadow-primary-100/70 transition-colors'

export const utilitySecondaryButtonClass =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap leading-none min-w-fit h-10 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors'

export function MetricTile({
  label,
  value,
  valueClassName = 'text-gray-900',
  className = '',
}) {
  return (
    <div
      className={`rounded-xl border border-gray-100 bg-gray-50 p-3 min-h-[86px] flex flex-col justify-between w-full ${className}`}
    >
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-1 whitespace-nowrap ${valueClassName}`}>
        {value}
      </p>
    </div>
  )
}
