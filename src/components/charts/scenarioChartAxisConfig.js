export const SCENARIO_CHART_BOTTOM_MARGIN = 40

export const SCENARIO_CHART_DEFAULT_MARGIN = {
  top: 8,
  right: 12,
  left: 12,
  bottom: SCENARIO_CHART_BOTTOM_MARGIN,
}

export const SCENARIO_X_AXIS_TICK_STYLE = {
  fill: '#64748B',
  fontSize: 12,
  fontWeight: 500,
}

export const SCENARIO_X_AXIS_LABEL_STYLE = {
  fill: '#9CA3AF',
  fontSize: 12,
  fontWeight: 500,
}

// X-axis labels must sit below tick labels. Keep all scenario charts on this
// shared layout system and never reduce bottom margin below the shared minimum,
// otherwise tick/title overlap will return as charts evolve.
export function getScenarioXAxisLayout(label) {
  return {
    tick: SCENARIO_X_AXIS_TICK_STYLE,
    tickMargin: 10,
    label: {
      value: label,
      position: 'insideBottom',
      dy: 22,
      style: {
        ...SCENARIO_X_AXIS_LABEL_STYLE,
        textAnchor: 'middle',
      },
    },
  }
}

export function getScenarioChartMargin(override = {}) {
  return {
    ...SCENARIO_CHART_DEFAULT_MARGIN,
    ...override,
    bottom: Math.max(
      Number(override?.bottom ?? SCENARIO_CHART_DEFAULT_MARGIN.bottom),
      SCENARIO_CHART_BOTTOM_MARGIN
    ),
  }
}
