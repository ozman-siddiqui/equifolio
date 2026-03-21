import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',')
  const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
  const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1]
  if (!timestamp || !signature) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === signature
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

  const valid = await verifyStripeSignature(body, signature, secret)
  if (!valid) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(body)

  const upsertSubscription = async (subscription: any) => {
    const userId = subscription.metadata?.user_id
    if (!userId) return

    const priceId = subscription.items?.data[0]?.price?.id
    const plan = (() => {
      if (priceId === Deno.env.get('STRIPE_PREMIUM_PRICE_ID')) return 'premium'
      if (priceId === Deno.env.get('STRIPE_INVESTOR_PRICE_ID')) return 'investor'
      return 'starter'
    })()

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      plan,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.subscription) {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` }
        })
        const subscription = await res.json()
        // Inject user_id from session metadata
        subscription.metadata = { ...subscription.metadata, user_id: session.metadata?.user_id, plan: session.metadata?.plan }
        await upsertSubscription(subscription)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await upsertSubscription(event.data.object)
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object
      if (invoice.subscription) {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${invoice.subscription}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` }
        })
        const subscription = await res.json()
        await upsertSubscription(subscription)
      }
      break
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
