import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
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

    const TRIGGER_SECRET = Deno.env.get('TRIGGER_SECRET') ?? ''
    const requestSecret = req.headers.get('x-trigger-secret') ?? ''

    if (!TRIGGER_SECRET || requestSecret !== TRIGGER_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

    // Get latest active rate event
    const { data: rateEvent, error: rateEventError } = await supabase
      .from('rate_events')
      .select('*')
      .eq('is_active', true)
      .order('announced_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rateEventError) throw rateEventError
    if (!rateEvent) {
      return new Response(
        JSON.stringify({ message: 'No active rate event found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const rateDelta = rateEvent.new_rate - rateEvent.previous_rate

    // Get all users
    const { data: usersData, error: usersError } =
      await supabase.auth.admin.listUsers()
    if (usersError) throw usersError
    if (!usersData?.users?.length) {
      return new Response(
        JSON.stringify({ message: 'No users found' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const results = []

    for (const user of usersData.users) {
      try {
        const userId = user.id

        // Deduplication check
        const { data: existing } = await supabase
          .from('portfolio_rate_impacts')
          .select('id')
          .eq('rate_event_id', rateEvent.id)
          .eq('user_id', userId)
          .maybeSingle()

        if (existing) {
          results.push({
            user_id: userId,
            status: 'skipped_already_computed'
          })
          continue
        }

        const userEmail = user.email ?? null

        // Get user loans
        const { data: loans } = await supabase
          .from('loans')
          .select('*')
          .eq('user_id', userId)

        if (!loans?.length) {
          results.push({
            user_id: userId,
            status: 'skipped_no_loans'
          })
          continue
        }

        // Compute monthly repayment delta for variable loans only
        // Uses loan_type === 'Fixed' consistent with existing app logic
        const computeMonthlyRepayment = (
          balance: number,
          annualRatePct: number,
          termMonths: number,
          isIO: boolean
        ): number => {
          const r = (annualRatePct / 100) / 12
          if (isIO || termMonths <= 0) {
            return balance * r
          }
          if (r === 0) return balance / termMonths
          return (balance * r * Math.pow(1 + r, termMonths)) /
            (Math.pow(1 + r, termMonths) - 1)
        }

        let prevMonthlyTotal = 0
        let newMonthlyTotal = 0

        for (const loan of loans) {
          // Skip fixed rate loans — not affected by RBA cash rate
          if (loan.loan_type === 'Fixed') continue

          const balance = Number(loan.current_balance || 0)
          const termMonths = Number(loan.remaining_term_months || 300)
          const isIO = loan.repayment_type === 'Interest Only'

          prevMonthlyTotal += computeMonthlyRepayment(
            balance,
            rateEvent.previous_rate,
            termMonths,
            isIO
          )
          newMonthlyTotal += computeMonthlyRepayment(
            balance,
            rateEvent.new_rate,
            termMonths,
            isIO
          )
        }

        const monthlyRepaymentDelta = Math.round(
          newMonthlyTotal - prevMonthlyTotal
        )

        // Insert impact row
        // borrowing_power_delta left null for V1
        // narrative left null for V1
        const { error: insertError } = await supabase
          .from('portfolio_rate_impacts')
          .insert({
            rate_event_id: rateEvent.id,
            user_id: userId,
            previous_rate: rateEvent.previous_rate,
            new_rate: rateEvent.new_rate,
            borrowing_power_delta: null,
            monthly_repayment_delta: monthlyRepaymentDelta,
            narrative: null,
          })

        if (insertError) throw insertError

        if (RESEND_API_KEY && userEmail && monthlyRepaymentDelta !== 0) {
          const isCut = monthlyRepaymentDelta < 0
          const absDelta = Math.abs(monthlyRepaymentDelta)

          const subject = isCut
            ? `RBA update: your repayments may reduce by $${absDelta}/month`
            : `RBA update: your repayments may increase by $${absDelta}/month`

          const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#1D9E75;padding:24px 28px;border-radius:8px 8px 0 0;">
          <p style="margin:0;font-size:11px;color:#ffffff;
                    letter-spacing:0.12em;text-transform:uppercase;">
            Market Update — Vaulta
          </p>
          <p style="margin:8px 0 0;font-size:20px;font-weight:700;
                    color:#ffffff;">
            RBA decision: portfolio impact calculated
          </p>
        </div>
        <div style="background:#ffffff;padding:28px;
                    border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
          <p style="font-size:28px;font-weight:700;
                    color:${isCut ? '#15803d' : '#be123c'};margin:0 0 16px;">
            ${isCut ? '−' : '+'}$${absDelta}/month
          </p>
          <p style="font-size:15px;color:#374151;margin:0 0 8px;">
            Cash rate moved from ${rateEvent.previous_rate}% to
            ${rateEvent.new_rate}%.
            This is the estimated impact on your variable loan repayments.
          </p>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">
            Fixed-rate loans are excluded and unaffected until expiry.
          </p>
          <a href="https://vaulta.com.au/dashboard"
             style="display:inline-block;background:#1D9E75;color:#ffffff;
                    padding:12px 24px;border-radius:8px;font-size:15px;
                    font-weight:600;text-decoration:none;">
            View portfolio impact →
          </a>
          <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">
            Indicative only. Based on current variable loan balances
            at the new cash rate. Not financial advice.
          </p>
        </div>
      </div>`

          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Vaulta <onboarding@resend.dev>',
                to: userEmail,
                subject,
                html,
              }),
            })

            if (!response.ok) {
              // Email failure must never crash the compute loop
            }
          } catch {
            // Email failure must never crash the compute loop
          }
        }

        results.push({
          user_id: userId,
          status: 'computed',
          monthly_repayment_delta: monthlyRepaymentDelta,
          variable_loans: loans.filter(
            (l: any) => l.loan_type !== 'Fixed'
          ).length,
          fixed_loans: loans.filter(
            (l: any) => l.loan_type === 'Fixed'
          ).length,
        })

      } catch (userError: any) {
        results.push({
          user_id: user.id,
          status: 'error',
          error: userError.message,
        })
      }
    }

    return new Response(
      JSON.stringify({
        rate_event_id: rateEvent.id,
        rate_delta: rateDelta,
        computed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
