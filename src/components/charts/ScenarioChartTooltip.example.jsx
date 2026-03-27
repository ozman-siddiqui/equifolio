import ScenarioChartTooltip from './ScenarioChartTooltip'

export default function ScenarioChartTooltipExample() {
  return (
    <div className="flex min-h-[240px] items-center justify-center bg-slate-50 p-8">
      <ScenarioChartTooltip
        contextLabel="Deposit"
        contextValue="25%"
        primaryLabel="Achievable purchase power"
        primaryValue="$1,053,000"
        supportingRows={[
          { label: 'Limiting factor', value: 'Borrowing' },
          { label: 'Required deposit', value: '$263,250' },
          { label: 'Acquisition costs', value: '$52,650' },
        ]}
        explanation="Your borrowing capacity is the constraint at this deposit level."
      />
    </div>
  )
}
