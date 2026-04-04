import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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
        { status: 200 }
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
        { status: 200 }
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
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
