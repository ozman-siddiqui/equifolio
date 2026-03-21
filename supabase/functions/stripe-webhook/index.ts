import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

serve(async (req: Request) => {
  try {
    const body = await req.text()
    const event = JSON.parse(body)
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') as string

    const upsertSub = async (sub: any, userId: string) => {
      const priceId = sub.items?.data[0]?.price?.id ?? ''
      let plan = 'starter'
      if (priceId === Deno.env.get('STRIPE_PREMIUM_PRICE_ID')) plan = 'premium'
      else if (priceId === Deno.env.get('STRIPE_INVESTOR_PRICE_ID')) plan = 'investor'

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        plan: plan,
        status: sub.status,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    }

    const fetchSub = async (subId: string) => {
      const res = await fetch('https://api.stripe.com/v1/subscriptions/' + subId, {
        headers: { 'Authorization': 'Bearer ' + stripeKey }
      })
      return res.json()
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.user_id
      if (session.subscription && userId) {
        const sub = await fetchSub(session.subscription)
        await upsertSub(sub, userId)
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      const userId = sub.metadata?.user_id
      if (userId) await upsertSub(sub, userId)
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object
      if (invoice.subscription) {
        const sub = await fetchSub(invoice.subscription)
        const userId = sub.metadata?.user_id
        if (userId) await upsertSub(sub, userId)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
