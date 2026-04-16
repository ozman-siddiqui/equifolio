import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildPortfolioRefinanceRanking } from '../../../src/lib/refinanceEngine.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeRepaymentType(raw: unknown) {
  const s = String(raw || '').trim().toLowerCase()
  return s.includes('interest only') || s === 'io'
    ? 'Interest Only'
    : 'Principal and Interest'
}

function toOccupancyType(propertyUse: unknown) {
  return String(propertyUse || '').trim().toLowerCase() === 'investment'
    ? 'investor'
    : 'owner_occupier'
}

function buildLvrBand(currentBalance: number, currentValue: number) {
  if (!(currentBalance > 0) || !(currentValue > 0)) return null

  const lvr = (currentBalance / currentValue) * 100
  return {
    lvr,
    lvrBand: lvr <= 80 ? '<=80' : '80-90',
  }
}

function buildDataHash(loan: Record<string, unknown>, benchmarkRate: number) {
  return [
    loan.id,
    Number(loan.interest_rate || 0),
    Number(benchmarkRate || 0),
    Number(loan.current_balance || 0),
  ].join('|')
}

function buildFallbackNarrative({
  currentRate,
  benchmarkRate,
  monthlySaving,
  annualSaving,
}: {
  currentRate: number
  benchmarkRate: number
  monthlySaving: number
  annualSaving: number
}) {
  return `Your current rate of ${currentRate}% appears above recent market benchmarks near ${benchmarkRate}%. This refinance scenario indicates a repayment difference of about $${Math.round(monthlySaving)}/month ($${Math.round(annualSaving)}/year). Consider discussing your options with a licensed mortgage broker.`
}

async function generateNarrative({
  anthropicKey,
  loan,
  benchmarkRate,
  monthlySaving,
  annualSaving,
  breakEvenMonths,
  occupancyType,
  normalizedRepayment,
}: {
  anthropicKey: string
  loan: Record<string, unknown>
  benchmarkRate: number
  monthlySaving: number
  annualSaving: number
  breakEvenMonths: number
  occupancyType: string
  normalizedRepayment: string
}) {
  if (!anthropicKey) {
    return buildFallbackNarrative({
      currentRate: Number(loan.interest_rate || 0),
      benchmarkRate,
      monthlySaving,
      annualSaving,
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system:
          'You are a financial insights writer for Australian property investors. Write a concise opportunity alert using only the JSON data provided. Rules: never change any numbers. Never give financial advice. Use cautious language only - words like may, could, appears, estimated. Maximum 3 sentences. Plain English. End with one suggested next action such as discussing options with a licensed mortgage broker.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              currentRate: loan.interest_rate,
              benchmarkRate,
              monthlySaving: Math.round(monthlySaving),
              annualSaving: Math.round(annualSaving),
              breakEvenMonths: Math.round(breakEvenMonths * 10) / 10,
              loanPurpose: occupancyType,
              repaymentType: normalizedRepayment,
              lender: loan.lender || 'your current lender',
            }),
          },
        ],
      }),
    })

    const data = await response.json()
    const narrative = data?.content?.[0]?.text
    if (typeof narrative === 'string' && narrative.trim()) {
      return narrative.trim()
    }
  } catch (_error) {
    // Fall back to the deterministic template below.
  }

  return buildFallbackNarrative({
    currentRate: Number(loan.interest_rate || 0),
    benchmarkRate,
    monthlySaving,
    annualSaving,
  })
}

async function recalculateValueTrackerForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: aggregates, error: aggregatesError } = await supabase
    .from('ai_opportunities')
    .select('annual_value_estimate, status')
    .eq('user_id', userId)

  if (aggregatesError) throw aggregatesError

  const cumulativeOpportunityValue = (aggregates || [])
    .filter((item) => ['active', 'reviewing', 'acted'].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.annual_value_estimate || 0), 0)

  const actedValue = (aggregates || [])
    .filter((item) => String(item.status) === 'acted')
    .reduce((sum, item) => sum + Number(item.annual_value_estimate || 0), 0)

  const { data: existingTracker, error: trackerFetchError } = await supabase
    .from('ai_value_tracker')
    .select('user_id, total_opportunities_detected')
    .eq('user_id', userId)
    .maybeSingle()

  if (trackerFetchError) throw trackerFetchError

  const { error: trackerUpsertError } = await supabase
    .from('ai_value_tracker')
    .upsert(
      {
        user_id: userId,
        cumulative_opportunity_value: cumulativeOpportunityValue,
        acted_value: actedValue,
        total_opportunities_detected: Number(existingTracker?.total_opportunities_detected || 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (trackerUpsertError) throw trackerUpsertError
}

type ActionableEntry = {
  analysis: Record<string, unknown>
  loan: Record<string, unknown>
  property: Record<string, unknown>
  benchmark: Record<string, unknown>
  occupancyType: string
  normalizedRepayment: string
  lvrState: { lvr: number; lvrBand: string }
  dataHash: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id: userId } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    )

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select(
        'id, property_id, interest_rate, current_balance, repayment_type, fixed_variable, loan_type, fixed_rate_expiry, interest_only_expiry, refinance_cost_estimate, offset_balance, remaining_term_months, lender, monthly_repayment, benchmark_rate'
      )
      .eq('user_id', userId)

    if (loansError) throw loansError

    const propertyIds = [...new Set((loans || []).map((loan) => loan.property_id).filter(Boolean))]
    const { data: properties, error: propertiesError } = propertyIds.length
      ? await supabase
          .from('properties')
          .select('id, property_use, current_value, address')
          .in('id', propertyIds)
      : { data: [], error: null }

    if (propertiesError) throw propertiesError

    const propertyMap = Object.fromEntries(
      (properties || []).map((property) => [String(property.id), property])
    )

    const incompleteLoans: string[] = []
    const completeLoans = []

    for (const loan of loans || []) {
      const property = propertyMap[String(loan.property_id)]
      const isComplete =
        Number(loan.interest_rate || 0) > 0 &&
        Number(loan.current_balance || 0) > 0 &&
        Boolean(loan.repayment_type) &&
        Number(property?.current_value || 0) > 0 &&
        Boolean(property?.property_use)

      if (!isComplete) {
        incompleteLoans.push(String(loan.id))
        continue
      }

      const occupancyType = toOccupancyType(property.property_use)
      const normalizedRepayment = normalizeRepaymentType(loan.repayment_type)
      const lvrState = buildLvrBand(
        Number(loan.current_balance || 0),
        Number(property.current_value || 0)
      )

      if (!lvrState) {
        incompleteLoans.push(String(loan.id))
        continue
      }

      completeLoans.push({
        ...loan,
        __occupancyType: occupancyType,
        __normalizedRepayment: normalizedRepayment,
        __lvrBand: lvrState.lvrBand,
      })
    }

    const { data: benchmarks, error: benchmarksError } = await supabase
      .from('market_rate_benchmarks')
      .select('occupancy_type, repayment_type, lvr_band, benchmark_rate')

    if (benchmarksError) throw benchmarksError

    const benchmarkLookup = Object.fromEntries(
      (benchmarks || []).map((row) => [
        `${row.occupancy_type}|${row.repayment_type}|${row.lvr_band}`,
        row,
      ])
    )

    const engineLoans = []
    const engineProperties = []

    for (const loan of completeLoans) {
      const benchmark =
        benchmarkLookup[
          `${loan.__occupancyType}|${loan.__normalizedRepayment}|${loan.__lvrBand}`
        ]

      if (!benchmark) continue

      const property = propertyMap[String(loan.property_id)]
      engineLoans.push({
        ...loan,
        benchmark_rate: benchmark.benchmark_rate,
      })
      engineProperties.push(property)
    }

    const analyses = buildPortfolioRefinanceRanking(engineLoans, engineProperties)
    const actionableAnalyses = analyses.filter(
      (analysis) => analysis.hasMeaningfulOpportunity && analysis.recommendationType === 'refinance'
    )
    const actionableEntries: ActionableEntry[] = actionableAnalyses
      .map((analysis) => {
        const loan = engineLoans.find((item) => String(item.id) === String(analysis.loanId))
        const property = loan ? propertyMap[String(loan.property_id)] : null
        if (!loan || !property) return null

        const occupancyType = toOccupancyType(property.property_use)
        const normalizedRepayment = normalizeRepaymentType(loan.repayment_type)
        const lvrState = buildLvrBand(
          Number(loan.current_balance || 0),
          Number(property.current_value || 0)
        )

        if (!lvrState) return null

        const benchmark =
          benchmarkLookup[`${occupancyType}|${normalizedRepayment}|${lvrState.lvrBand}`]

        if (!benchmark) return null

        return {
          analysis,
          loan,
          property,
          benchmark,
          occupancyType,
          normalizedRepayment,
          lvrState,
          dataHash: buildDataHash(loan, Number(benchmark.benchmark_rate || 0)),
        }
      })
      .filter((entry): entry is ActionableEntry => entry !== null)

    const currentActionableKeys = new Set(
      actionableEntries.map((entry) => `${entry.loan.id}|${entry.dataHash}`)
    )

    const { data: existingActiveReviewing, error: existingActiveReviewingError } = await supabase
      .from('ai_opportunities')
      .select('id, loan_id, data_hash')
      .eq('user_id', userId)
      .eq('opportunity_type', 'refinance')
      .in('status', ['active', 'reviewing'])

    if (existingActiveReviewingError) throw existingActiveReviewingError

    const staleOpportunityIds = (existingActiveReviewing || [])
      .filter((row) => !currentActionableKeys.has(`${row.loan_id}|${row.data_hash}`))
      .map((row) => row.id)

    if (staleOpportunityIds.length > 0) {
      const { error: expireError } = await supabase
        .from('ai_opportunities')
        .update({
          status: 'expired',
          last_evaluated_at: new Date().toISOString(),
        })
        .in('id', staleOpportunityIds)

      if (expireError) throw expireError
    }

    let newOpportunityCount = 0

    for (const entry of actionableEntries) {
      const {
        analysis,
        loan,
        property,
        benchmark,
        occupancyType,
        normalizedRepayment,
        lvrState,
        dataHash,
      } = entry
      const { data: existingOpportunity, error: existingError } = await supabase
        .from('ai_opportunities')
        .select('id')
        .eq('loan_id', loan.id)
        .eq('data_hash', dataHash)
        .in('status', ['active', 'reviewing'])
        .order('detected_at', { ascending: false })
        .limit(1)

      if (existingError) throw existingError

      const matchingOpportunity = existingOpportunity?.[0]

      if (matchingOpportunity?.id) {
        const { error: updateError } = await supabase
          .from('ai_opportunities')
          .update({ last_evaluated_at: new Date().toISOString() })
          .eq('id', matchingOpportunity.id)

        if (updateError) throw updateError
        continue
      }

      const narrative = await generateNarrative({
        anthropicKey,
        loan,
        benchmarkRate: Number(benchmark.benchmark_rate || 0),
        monthlySaving: Number(analysis.monthlySavings || 0),
        annualSaving: Number(analysis.annualSavings || 0),
        breakEvenMonths: Number(analysis.breakEvenMonths || 0),
        occupancyType,
        normalizedRepayment,
      })

      const now = new Date().toISOString()
      const confidenceLevel = String(analysis.confidenceLabel || 'Low').toLowerCase()
      const annualSaving = Number(analysis.annualSavings || 0)
      const breakEvenMonths = Number(analysis.breakEvenMonths || 0)
      const priorityScore = Math.min(
        100,
        Math.round(annualSaving / 100 + (18 - breakEvenMonths) * 2)
      )
      const title = `Refinance scenario for ${property.address || 'this property'}`

      const { error: insertError } = await supabase.from('ai_opportunities').insert({
        user_id: userId,
        property_id: property.id,
        loan_id: loan.id,
        opportunity_type: 'refinance',
        title,
        narrative,
        annual_value_estimate: annualSaving,
        monthly_value_estimate: Number(analysis.monthlySavings || 0),
        break_even_months: breakEvenMonths,
        priority_score: priorityScore,
        confidence_level:
          confidenceLevel === 'high' || confidenceLevel === 'medium' || confidenceLevel === 'low'
            ? confidenceLevel
            : 'low',
        status: 'active',
        data_hash: dataHash,
        detected_at: now,
        last_evaluated_at: now,
        metadata: {
          benchmark_rate: Number(benchmark.benchmark_rate || 0),
          benchmark_source: analysis.benchmarkSource,
          occupancy_type: occupancyType,
          repayment_type: normalizedRepayment,
          lvr_band: lvrState.lvrBand,
          rate_gap_pct: Number(analysis.rateGapPct || 0),
          reasons: analysis.reasons,
          warnings: analysis.warnings,
        },
      })

      if (insertError) {
        if (String(insertError.code || '') === '23505') {
          const { data: duplicateOpportunity, error: duplicateFetchError } = await supabase
            .from('ai_opportunities')
            .select('id')
            .eq('loan_id', loan.id)
            .eq('data_hash', dataHash)
            .in('status', ['active', 'reviewing'])
            .order('detected_at', { ascending: false })
            .limit(1)

          if (duplicateFetchError) throw duplicateFetchError

          const matchingDuplicate = duplicateOpportunity?.[0]
          if (matchingDuplicate?.id) {
            const { error: duplicateUpdateError } = await supabase
              .from('ai_opportunities')
              .update({ last_evaluated_at: now })
              .eq('id', matchingDuplicate.id)

            if (duplicateUpdateError) throw duplicateUpdateError
            continue
          }
        }

        throw insertError
      }
      newOpportunityCount += 1
    }

    if (newOpportunityCount > 0) {
      const { data: existingTracker, error: trackerFetchError } = await supabase
        .from('ai_value_tracker')
        .select('user_id, total_opportunities_detected')
        .eq('user_id', userId)
        .maybeSingle()

      if (trackerFetchError) throw trackerFetchError

      const totalDetected =
        Number(existingTracker?.total_opportunities_detected || 0) + newOpportunityCount

      const { error: trackerCountUpdateError } = await supabase
        .from('ai_value_tracker')
        .upsert(
          {
            user_id: userId,
            total_opportunities_detected: totalDetected,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (trackerCountUpdateError) throw trackerCountUpdateError
    }

    await recalculateValueTrackerForUser(supabase, userId)

    const { data: opportunities, error: opportunitiesError } = await supabase
      .from('ai_opportunities')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'reviewing'])
      .order('priority_score', { ascending: false })
      .order('detected_at', { ascending: false })

    if (opportunitiesError) throw opportunitiesError

    return new Response(
      JSON.stringify({
        opportunities: opportunities || [],
        incomplete_loans: incompleteLoans,
        updated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
