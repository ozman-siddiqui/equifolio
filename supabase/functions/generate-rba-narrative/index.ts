import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NARRATIVE_PROMPT = (
  decisionLabel: string,
  previousRate: number,
  newRate: number,
  monthlyDelta: number,
  variableLoanCount: number,
  variableSummary: string,
  fixedLoanCount: number,
  fixedExpirySummary: string
) => `You are a neutral property portfolio analyst writing general information only. Write exactly 2 sentences summarising what this RBA rate decision means for this specific investor. Use cautious, scenario-based language, include dollar amounts, and reference their actual portfolio context. Do not give financial advice, credit advice, or directive recommendations. Do not use wording such as "You should review", "You should start preparing", "lock in current rates", "before rates rise further", "best move", "recommended action", or "locking in current rates now". Do not tell the user to act immediately, lock in rates, or prepare now.

RBA decision: Cash rate ${decisionLabel} — from ${previousRate}% to ${newRate}%.
Estimated monthly repayment change on variable loans: ${monthlyDelta < 0 ? '-' : '+'}$${Math.abs(monthlyDelta)}/month.
Variable loans (${variableLoanCount}): ${variableSummary || 'none'}.
${fixedLoanCount > 0 ? `Fixed loans unaffected (${fixedLoanCount}): ${fixedExpirySummary}.` : ''}

Sentence 1: Summarise what this rate decision means for their repayments in dollar terms, referencing the relevant properties or loans dynamically from the provided data. Preferred style: "Your monthly repayments on the variable loan at {propertyAddress} may increase by approximately ${Math.abs(monthlyDelta)}." If a projected new monthly repayment is not explicitly available from the provided data, do not invent it.
Sentence 2: Use this exact style: "This scenario may warrant review, particularly where current variable rates exceed available fixed-rate benchmarks. Consider discussing available options with a licensed broker or adviser." Keep all property names, rate values, and repayment values dynamic from the provided data.`

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()

    function decodeJwtPayload(jwt: string) {
      const parts = jwt.split('.')
      if (parts.length !== 3) return null

      const base64 = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/')

      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)

      try {
        return JSON.parse(atob(padded))
      } catch {
        return null
      }
    }

    const jwtPayload = decodeJwtPayload(token)
    const authenticatedUserId = jwtPayload?.sub ?? null

    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Accept only rate_impact_id from client — never trust client-supplied user_id
    const { rate_impact_id } = await req.json()

    if (!rate_impact_id) {
      return new Response(
        JSON.stringify({ error: 'Missing rate_impact_id' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch impact row first — derive user_id from DB, not from client
    const { data: impact, error: impactError } = await supabase
      .from('portfolio_rate_impacts')
      .select('*')
      .eq('id', rate_impact_id)
      .maybeSingle()

    if (impactError || !impact) {
      return new Response(
        JSON.stringify({ error: 'Impact row not found' }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Derive user_id from the DB row — never from client input
    if (impact.user_id !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const user_id = impact.user_id

    // If narrative already exists, return it — no Anthropic call needed
    if (impact.narrative) {
      return new Response(
        JSON.stringify({ narrative: impact.narrative }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Fetch portfolio context for personalised narrative
    const [{ data: loans }, { data: properties }] = await Promise.all([
      supabase
        .from('loans')
        .select('property_id, loan_type, repayment_type, current_balance, interest_rate, fixed_rate_expiry')
        .eq('user_id', user_id),
      supabase
        .from('properties')
        .select('id, address')
        .eq('user_id', user_id),
    ])

    const variableLoans = (loans ?? []).filter(
      (l: any) => l.loan_type !== 'Fixed'
    )
    const fixedLoans = (loans ?? []).filter(
      (l: any) => l.loan_type === 'Fixed'
    )

    const rateDelta = impact.new_rate - impact.previous_rate
    const isCut = rateDelta < 0
    const decisionLabel = isCut
      ? `cut by ${Math.abs(rateDelta).toFixed(2)}%`
      : `hiked by ${Math.abs(rateDelta).toFixed(2)}%`

    const variableSummary = variableLoans
      .map((l: any) => {
        const prop = (properties ?? []).find((p: any) => p.id === l.property_id)
        return `${prop?.address ?? 'investment property'} — $${Math.round(Number(l.current_balance)).toLocaleString()} at ${l.interest_rate}% (${l.repayment_type})`
      })
      .join('; ')

    const fixedExpirySummary = fixedLoans
      .map((l: any) => {
        const prop = (properties ?? []).find((p: any) => p.id === l.property_id)
        return l.fixed_rate_expiry
          ? `${prop?.address ?? 'investment property'} fixed until ${l.fixed_rate_expiry}`
          : `${prop?.address ?? 'investment property'} on fixed rate`
      })
      .join('; ')

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 180,
        messages: [{
          role: 'user',
          content: NARRATIVE_PROMPT(
            decisionLabel,
            impact.previous_rate,
            impact.new_rate,
            impact.monthly_repayment_delta,
            variableLoans.length,
            variableSummary,
            fixedLoans.length,
            fixedExpirySummary
          )
        }],
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      return new Response(
        JSON.stringify({ error: 'Anthropic API call failed', details }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const aiData = await response.json()
    const narrative = aiData.content?.[0]?.text ?? null

    // Save narrative to DB — future logins never re-call Anthropic
    if (narrative) {
      await supabase
        .from('portfolio_rate_impacts')
        .update({ narrative })
        .eq('id', rate_impact_id)
    }

    return new Response(
      JSON.stringify({ narrative }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
