import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { property, loans, transactions } = await req.json()

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    // Build financial summary for Claude
    const totalDebt = loans.reduce((sum: number, l: any) => sum + Number(l.current_balance), 0)
    const equity = Number(property.current_value) - totalDebt
    const lvr = totalDebt > 0 ? ((totalDebt / Number(property.current_value)) * 100).toFixed(1) : 0
    const growth = Number(property.current_value) - Number(property.purchase_price)
    const growthPct = ((growth / Number(property.purchase_price)) * 100).toFixed(1)

    // Frequency converter
    const toMonthly = (amount: number, frequency: string) => {
      const map: Record<string, number> = {
        Weekly: 52 / 12, Fortnightly: 26 / 12, Monthly: 1, Quarterly: 1 / 3, Annual: 1 / 12
      }
      return Number(amount) * (map[frequency] || 1)
    }

    const allIncome = transactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + toMonthly(t.amount, t.frequency), 0)
    const allExpenses = transactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + toMonthly(t.amount, t.frequency), 0)
    const uniqueMonths = [...new Set(transactions.map((t: any) => t.date.slice(0, 7)))].length || 1
    const monthlyNet = (allIncome - allExpenses) / uniqueMonths
    const annualNet = monthlyNet * 12
    const netYield = ((annualNet / Number(property.current_value)) * 100).toFixed(2)
    const grossYield = (((allIncome / uniqueMonths) * 12 / Number(property.current_value)) * 100).toFixed(2)

    const loanDetails = loans.map((l: any) =>
      `${l.lender} - ${l.loan_type} ${l.interest_rate}% ${l.repayment_type}, balance $${Number(l.current_balance).toLocaleString()}${l.fixed_rate_expiry ? `, fixed until ${l.fixed_rate_expiry}` : ''}`
    ).join('\n')

    const prompt = `You are an Australian property investment analyst. Analyse this investment property and provide a buy/hold/sell recommendation.

PROPERTY DETAILS:
- Address: ${property.address}, ${property.suburb}, ${property.state}
- Type: ${property.property_type}
- Use: ${property.property_use}
- Purchase price: $${Number(property.purchase_price).toLocaleString()}
- Current value: $${Number(property.current_value).toLocaleString()}
- Capital growth: $${Number(growth).toLocaleString()} (${growthPct}%)
- Purchase date: ${property.purchase_date}

FINANCIAL POSITION:
- Total debt: $${totalDebt.toLocaleString()}
- Equity: $${equity.toLocaleString()}
- LVR: ${lvr}%
- Gross yield: ${grossYield}% p.a.
- Net yield: ${netYield}% p.a.
- Monthly net cash flow: $${Math.round(monthlyNet).toLocaleString()}

MORTGAGES:
${loanDetails || 'No loans recorded'}

DATA PERIOD: Based on ${uniqueMonths} month(s) of transaction data.

Provide your analysis in this exact JSON format:
{
  "recommendation": "BUY" | "HOLD" | "SELL",
  "score": <number 1-10>,
  "summary": "<one sentence summary of the recommendation>",
  "reasons": [
    "<reason 1>",
    "<reason 2>",
    "<reason 3>"
  ],
  "risks": [
    "<risk 1>",
    "<risk 2>"
  ],
  "opportunity": "<one specific actionable opportunity for this property>"
}

Be direct and specific to Australian property market conditions. Reference actual numbers from the data. Score 1-10 where 10 is exceptional investment, 5 is neutral hold, 1 is sell immediately. Return only valid JSON.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

const aiData = await response.json()

if (!aiData.content || !aiData.content[0]) {
  return new Response(JSON.stringify({ error: `API error: ${JSON.stringify(aiData)}` }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

const text = aiData.content[0].text

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Could not parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const result = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})