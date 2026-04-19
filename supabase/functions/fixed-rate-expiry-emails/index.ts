import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOUCHPOINTS = [
  { key: 'fixed_rate_expiry_education', minDays: 40, maxDays: 47 },
  { key: 'fixed_rate_expiry_decision',  minDays: 25, maxDays: 33 },
  { key: 'fixed_rate_expiry_urgent',    minDays: 10, maxDays: 17 },
]

function getDaysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function buildEmailContent(
  touchpointKey: string,
  userId: string,
  lender: string,
  daysUntil: number,
  currentRate: number,
  expiryDate: string
) {
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
  const formattedRate = `${currentRate}%`

  if (touchpointKey === 'fixed_rate_expiry_education') {
    return {
      subject: `Your ${lender} fixed rate expires in ${daysUntil} days — start reviewing now`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#1D9E75;padding:24px 28px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:11px;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;">Fixed Rate Alert — Nextiq</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Your fixed rate is approaching expiry</p>
          </div>
          <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
            <p style="font-size:15px;color:#374151;margin:0 0 16px;">Your <strong>${lender}</strong> loan fixed rate of <strong>${formattedRate}</strong> expires on <strong>${formattedDate}</strong> — in ${daysUntil} days.</p>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">When your fixed rate expires, your loan reverts to the variable rate automatically unless you take action. Now is the right time to review your options.</p>
            <a href="https://www.nextiq.com.au/dashboard" style="display:inline-block;background:#1D9E75;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Review your options →</a>
            <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Illustrative only. Not financial advice.</p>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">You’re receiving this because you’re using Nextiq.</p>
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">Nextiq provides general informational insights only and does not constitute financial, tax, or lending advice.</p>
              <a href="https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/unsubscribe?u=${userId}"
                 style="color:#9ca3af;font-size:12px;text-decoration:underline;">
                Unsubscribe from alerts
              </a>
            </div>
          </div>
        </div>`
    }
  }

  if (touchpointKey === 'fixed_rate_expiry_decision') {
    return {
      subject: `${daysUntil} days until your ${lender} fixed rate expires — time to decide`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#B45309;padding:24px 28px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:11px;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;">Fixed Rate Alert — Nextiq</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Time to decide on your ${lender} loan</p>
          </div>
          <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
            <p style="font-size:15px;color:#374151;margin:0 0 16px;">Your fixed rate of <strong>${formattedRate}</strong> expires on <strong>${formattedDate}</strong> — in <strong>${daysUntil} days</strong>.</p>
            <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">This is the optimal window to compare refinancing against reverting to variable.</p>
            <a href="https://www.nextiq.com.au/dashboard" style="display:inline-block;background:#1D9E75;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Compare your options →</a>
            <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Illustrative only. Not financial advice.</p>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">You’re receiving this because you’re using Nextiq.</p>
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">Nextiq provides general informational insights only and does not constitute financial, tax, or lending advice.</p>
              <a href="https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/unsubscribe?u=${userId}"
                 style="color:#9ca3af;font-size:12px;text-decoration:underline;">
                Unsubscribe from alerts
              </a>
            </div>
          </div>
        </div>`
    }
  }

  if (touchpointKey === 'fixed_rate_expiry_urgent') {
    return {
      subject: `Urgent: Your ${lender} fixed rate expires in ${daysUntil} days`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#BE123C;padding:24px 28px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:11px;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;">Urgent — Nextiq</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700;color:#ffffff;">Action required — your fixed rate expires soon</p>
          </div>
          <div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
            <p style="font-size:15px;color:#374151;margin:0 0 16px;">Your <strong>${lender}</strong> fixed rate of <strong>${formattedRate}</strong> expires on <strong>${formattedDate}</strong> — only <strong>${daysUntil} days away</strong>.</p>
            <p style="font-size:14px;color:#6b7280;margin:0 0 24px;"><strong>Contact your lender or mortgage broker today.</strong></p>
            <a href="https://www.nextiq.com.au/dashboard" style="display:inline-block;background:#1D9E75;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">Review your position →</a>
            <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">Illustrative only. Not financial advice.</p>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">You’re receiving this because you’re using Nextiq.</p>
              <p style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0 0 8px;">Nextiq provides general informational insights only and does not constitute financial, tax, or lending advice.</p>
              <a href="https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/unsubscribe?u=${userId}"
                 style="color:#9ca3af;font-size:12px;text-decoration:underline;">
                Unsubscribe from alerts
              </a>
            </div>
          </div>
        </div>`
    }
  }

  return null
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

    // Verify caller presents service role key
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    if (token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { data: loans, error: loansError } = await supabase
      .from('loans')
      .select('id, user_id, lender, fixed_rate_expiry, interest_rate, loan_type')
      .eq('loan_type', 'Fixed')
      .not('fixed_rate_expiry', 'is', null)

    if (loansError) throw loansError
    if (!loans?.length) {
      return new Response(
        JSON.stringify({ message: 'No fixed rate loans found' }),
        { status: 200 }
      )
    }

    const results = []

    for (const loan of loans) {
      const daysUntil = getDaysUntil(loan.fixed_rate_expiry)
      if (daysUntil === null || daysUntil < 0) continue

      for (const touchpoint of TOUCHPOINTS) {
        if (daysUntil < touchpoint.minDays || daysUntil > touchpoint.maxDays) continue

        const { data: existing } = await supabase
          .from('email_log')
          .select('id')
          .eq('user_id', loan.user_id)
          .eq('loan_id', loan.id)
          .eq('email_type', touchpoint.key)
          .maybeSingle()

        if (existing) {
          results.push({
            loan_id: loan.id,
            touchpoint: touchpoint.key,
            status: 'skipped_already_sent'
          })
          continue
        }

        const { data: userData } = await supabase.auth.admin.getUserById(loan.user_id)
        const userEmail = userData?.user?.email
        if (!userEmail) {
          results.push({
            loan_id: loan.id,
            touchpoint: touchpoint.key,
            status: 'skipped_no_email'
          })
          continue
        }

        const content = buildEmailContent(
          touchpoint.key,
          loan.user_id,
          loan.lender,
          daysUntil,
          loan.interest_rate,
          loan.fixed_rate_expiry
        )
        if (!content) continue

        const userId = loan.user_id
        const { data: profileData } = await supabase
          .from('user_financial_profiles')
          .select('alerts_opt_out')
          .eq('user_id', userId)
          .maybeSingle()

        if (profileData?.alerts_opt_out === true) {
          results.push({ user_id: userId, status: 'skipped_opted_out' })
          continue
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Nextiq <alerts@nextiq.com.au>',
            reply_to: 'support@nextiq.com.au',
            to: userEmail,
            subject: content.subject,
            html: content.html,
          }),
        })

        if (!emailResponse.ok) {
          const err = await emailResponse.text()
          results.push({
            loan_id: loan.id,
            touchpoint: touchpoint.key,
            status: 'error',
            error: err
          })
          continue
        }

        await supabase.from('email_log').insert({
          user_id: loan.user_id,
          loan_id: loan.id,
          email_type: touchpoint.key,
          metadata: {
            lender: loan.lender,
            days_until: daysUntil,
            expiry_date: loan.fixed_rate_expiry,
            email_address: userEmail,
          }
        })

        results.push({
          loan_id: loan.id,
          touchpoint: touchpoint.key,
          status: 'sent',
          email: userEmail,
          days_until: daysUntil
        })
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
