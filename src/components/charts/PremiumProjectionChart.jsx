import { useEffect, useRef, useState } from 'react'

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Label,
} from 'recharts'

import PremiumProjectionTooltip from './PremiumProjectionTooltip'
import {
  SCENARIO_CHART_DEFAULT_MARGIN,
  getScenarioXAxisLayout,
  getScenarioChartMargin,
} from './scenarioChartAxisConfig'

const TOOLTIP_WIDTH = 248
const TOOLTIP_HEIGHT = 182
const TOOLTIP_EDGE_PADDING = 20
const TOOLTIP_CURSOR_OFFSET = 18

const defaultCurrencyFormatter = (value) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const defaultAxisFormatter = (value) => {
  const numericValue = Number(value || 0)

  if (Math.abs(numericValue) >= 1000000) {
    return `${numericValue < 0 ? '-' : ''}$${Math.abs(numericValue / 1000000).toFixed(1)}m`
  }

  if (Math.abs(numericValue) >= 1000) {
    return `${numericValue < 0 ? '-' : ''}$${Math.abs(numericValue / 1000).toFixed(0)}k`
  }

  return `${numericValue < 0 ? '-' : ''}$${Math.abs(numericValue).toFixed(0)}`
}

function PremiumLegend({ payload }) {
  if (!payload?.length) return null

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-medium text-slate-600">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function ReferenceLineStackedLabel({
  viewBox,
  lines = [],
  fill = '#6B7280',
}) {
  if (!viewBox || !lines.length) return null

  const x = Number(viewBox.x ?? 0)
  const y = Math.max(Number(viewBox.y ?? 0) - 10, 10)

  return (
    <text x={x} y={y} textAnchor="middle" fill={fill}>
      {lines.map((line, index) => (
        <tspan
          key={`${line}-${index}`}
          x={x}
          dy={index === 0 ? 0 : 12}
          fontSize={index === 0 ? 13 : 10}
          fontWeight={index === 0 ? 500 : 500}
          fill={index === 0 ? fill : '#6B7280'}
        >
          {line}
        </tspan>
      ))}
    </text>
  )
}

export default function PremiumProjectionChart({
  data = [],
  series = [],
  title = null,
  subtitle = null,
  valueFormatter = defaultCurrencyFormatter,
  axisFormatter = defaultAxisFormatter,
  xAxisKey = 'year',
  xAxisType = 'category',
  xAxisDomain = undefined,
  xAxisTicks = undefined,
  xAxisTickFormatter = undefined,
  xAxisLabel = 'Years',
  xAxisConfig = undefined,
  yAxisLabel = 'Value ($)',
  rightYAxisLabel = null,
  rightAxisFormatter = defaultAxisFormatter,
  tooltipLabelTitle = 'Year',
  getExtraTooltipRows = null,
  tooltipContent = null,
  referenceLines = [],
  chartOverlay = null,
  chartMargin = SCENARIO_CHART_DEFAULT_MARGIN,
  height = 360,
}) {
  const legendSeries = series.filter((item) => item.showInLegend !== false)
  const tooltipSeries = series.filter((item) => item.showInTooltip !== false)
  const chartContainerRef = useRef(null)
  const [chartBounds, setChartBounds] = useState({ width: 0, height })
  const [tooltipPosition, setTooltipPosition] = useState(null)
  const resolvedXAxisConfig = xAxisConfig || getScenarioXAxisLayout(xAxisLabel)
  const resolvedChartMargin = getScenarioChartMargin(chartMargin)

  useEffect(() => {
    if (!chartContainerRef.current) return undefined

    const updateBounds = () => {
      const nextWidth = chartContainerRef.current?.clientWidth || 0
      setChartBounds({ width: nextWidth, height })
    }

    updateBounds()

    const resizeObserver = new ResizeObserver(() => {
      updateBounds()
    })

    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [height])

  const handleMouseMove = (state) => {
    if (!state?.isTooltipActive) return

    const nextX = Number(state.chartX ?? state.activeCoordinate?.x ?? 0)
    const nextY = Number(state.chartY ?? state.activeCoordinate?.y ?? 0)
    const chartWidth = Number(chartBounds.width || 0)
    const chartHeight = Number(chartBounds.height || height)

    if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || chartWidth <= 0) return

    const preferredLeftPlacement = nextX > chartWidth * 0.58
    const unclampedX = preferredLeftPlacement
      ? nextX - TOOLTIP_WIDTH - TOOLTIP_CURSOR_OFFSET
      : nextX + TOOLTIP_CURSOR_OFFSET
    const unclampedY = nextY - TOOLTIP_HEIGHT / 2

    const boundedX = Math.min(
      Math.max(unclampedX, TOOLTIP_EDGE_PADDING),
      Math.max(chartWidth - TOOLTIP_WIDTH - TOOLTIP_EDGE_PADDING, TOOLTIP_EDGE_PADDING)
    )
    const boundedY = Math.min(
      Math.max(unclampedY, TOOLTIP_EDGE_PADDING),
      Math.max(chartHeight - TOOLTIP_HEIGHT - TOOLTIP_EDGE_PADDING, TOOLTIP_EDGE_PADDING)
    )

    setTooltipPosition((currentPosition) => {
      if (
        currentPosition &&
        currentPosition.x === boundedX &&
        currentPosition.y === boundedY
      ) {
        return currentPosition
      }

      return { x: boundedX, y: boundedY }
    })
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
      {title || subtitle ? (
        <header className="border-b border-slate-100 px-6 py-5 md:px-7">
          {title ? (
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
          ) : null}
        </header>
      ) : null}

      <div ref={chartContainerRef} className="relative px-4 py-5 md:px-6 md:py-6">
        {chartOverlay ? <div className="pointer-events-none absolute inset-x-0 top-4 z-10">{chartOverlay}</div> : null}
        <div className="mb-4 mt-2 md:mb-5">
          <PremiumLegend
            payload={legendSeries.map((item) => ({
              dataKey: item.dataKey,
              value: item.label,
              color: item.color,
            }))}
          />
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={resolvedChartMargin}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltipPosition(null)}
          >
            <CartesianGrid
              vertical={false}
              stroke="#E2E8F0"
              strokeDasharray="3 7"
            />
            <XAxis
              dataKey={xAxisKey}
              type={xAxisType}
              domain={xAxisDomain}
              ticks={xAxisTicks}
              axisLine={false}
              tickLine={false}
              tick={resolvedXAxisConfig.tick}
              tickMargin={resolvedXAxisConfig.tickMargin}
              tickFormatter={xAxisTickFormatter}
            >
              <Label {...resolvedXAxisConfig.label} />
            </XAxis>
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
              tickFormatter={axisFormatter}
              width={84}
            >
              <Label
                value={yAxisLabel}
                angle={-90}
                position="insideLeft"
                offset={12}
                style={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 500, textAnchor: 'middle' }}
              />
            </YAxis>
            {rightYAxisLabel ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                tickFormatter={rightAxisFormatter}
                width={84}
              >
                <Label
                  value={rightYAxisLabel}
                  angle={90}
                  position="insideRight"
                  offset={12}
                  style={{
                    fill: '#9CA3AF',
                    fontSize: 12,
                    fontWeight: 500,
                    textAnchor: 'middle',
                  }}
                />
              </YAxis>
            ) : null}
            <Tooltip
              isAnimationActive={false}
              offset={18}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 20 }}
              position={tooltipPosition || undefined}
              cursor={{ stroke: '#CBD5E1', strokeWidth: 1.25, strokeDasharray: '4 5' }}
              content={
                tooltipContent ||
                (
                  <PremiumProjectionTooltip
                    series={tooltipSeries}
                    valueFormatter={valueFormatter}
                    labelTitle={tooltipLabelTitle}
                    getExtraRows={getExtraTooltipRows}
                  />
                )
              }
            />
            {referenceLines.map((referenceLine) => (
              <ReferenceLine
                key={`${referenceLine.axis || 'x'}-${referenceLine.value}`}
                x={referenceLine.axis === 'x' ? referenceLine.value : undefined}
                y={referenceLine.axis === 'y' ? referenceLine.value : undefined}
                stroke={referenceLine.stroke || '#94A3B8'}
                strokeDasharray={referenceLine.strokeDasharray}
                strokeWidth={referenceLine.strokeWidth || 1.25}
                strokeOpacity={referenceLine.strokeOpacity ?? 1}
                ifOverflow={referenceLine.ifOverflow}
                isFront={referenceLine.isFront}
                label={
                  referenceLine.labelLines?.length
                    ? (
                        <ReferenceLineStackedLabel
                          lines={referenceLine.labelLines}
                          fill={referenceLine.labelColor || '#6B7280'}
                        />
                      )
                    : referenceLine.label
                    ? {
                        value: referenceLine.label,
                        position: referenceLine.labelPosition || 'top',
                        fill: referenceLine.labelColor || '#6B7280',
                        fontSize: 12,
                      }
                    : undefined
                }
              />
            ))}

            {series.map((item) => (
              <Line
                key={item.dataKey}
                type={item.type || 'monotone'}
                yAxisId={item.yAxisId || 'left'}
                dataKey={item.dataKey}
                name={item.label}
                stroke={item.color}
                strokeWidth={item.strokeWidth ?? 2.75}
                strokeDasharray={item.strokeDasharray}
                dot={item.dot ?? false}
                activeDot={
                  item.activeDot ?? {
                    r: 6,
                    stroke: '#FFFFFF',
                    strokeWidth: 2.75,
                    fill: item.color,
                  }
                }
                connectNulls={item.connectNulls ?? true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
