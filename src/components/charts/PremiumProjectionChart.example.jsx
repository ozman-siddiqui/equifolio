import PremiumProjectionChart from './PremiumProjectionChart'

const exampleProjectionData = [
  { year: 'Year 1', baseEquity: 510000, optimisedEquity: 528000, stretchEquity: 542000 },
  { year: 'Year 2', baseEquity: 548000, optimisedEquity: 579000, stretchEquity: 602000 },
  { year: 'Year 3', baseEquity: 587000, optimisedEquity: 635000, stretchEquity: 668000 },
  { year: 'Year 4', baseEquity: 626000, optimisedEquity: 692000, stretchEquity: 735000 },
  { year: 'Year 5', baseEquity: 668000, optimisedEquity: 754000, stretchEquity: 812000 },
]

const exampleSeries = [
  { dataKey: 'baseEquity', label: 'Base path', color: '#0F172A' },
  { dataKey: 'optimisedEquity', label: 'Optimised path', color: '#C2410C' },
  { dataKey: 'stretchEquity', label: 'Stretch path', color: '#2563EB' },
]

export default function PremiumProjectionChartExample() {
  return (
    <PremiumProjectionChart
      title="5-Year Equity Projection"
      subtitle="Example only. This shows how multiple planning paths can be compared in a single premium chart surface."
      data={exampleProjectionData}
      series={exampleSeries}
    />
  )
}

