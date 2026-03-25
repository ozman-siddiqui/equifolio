function clamp(lines) {
  return {
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  }
}

export default function MetricRow({ label, value, helper = '', emphasis = false }) {
  return (
    <div className="grid min-h-[76px] grid-cols-[minmax(0,1fr),auto] gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 break-words">{label}</p>
        {helper ? (
          <p className="mt-1 text-xs leading-5 text-gray-500 break-words" style={clamp(2)}>
            {helper}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 max-w-[170px] text-right">
        <p
          className={`text-sm font-semibold break-words ${emphasis ? 'text-primary-700' : 'text-gray-900'}`}
          style={clamp(2)}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
