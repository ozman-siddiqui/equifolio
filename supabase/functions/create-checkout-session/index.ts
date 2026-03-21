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
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_ANON_KEY') as string,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { plan } = await req.json()
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') as string
    const appUrl = Deno.env.get('APP_URL') as string

    const priceMap: Record<string, string> = {
      starter: Deno.env.get('STRIPE_STARTER_PRICE_ID') as string,
      investor: Deno.env.get('STRIPE_INVESTOR_PRICE_ID') as string,
      premium: Deno.env.get('STRIPE_PREMIUM_PRICE_ID') as string,
    }

    // Create Stripe customer
    const customerRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: user.email as string,
        'metadata[user_id]': user.id,
      }),
    })
    const customer = await customerRes.json()

    if (!customer.id) {
      return new Response(JSON.stringify({ error: `Customer error: ${JSON.stringify(customer)}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create checkout session
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customer.id,
        'payment_method_types[]': 'card',
        'line_items[0][price]': priceMap[plan],
        'line_items[0][quantity]': '1',
        mode: 'subscription',
        success_url: `${appUrl}?subscription=success`,
        cancel_url: `${appUrl}/pricing?canceled=true`,
        'metadata[user_id]': user.id,
        'metadata[plan]': plan,
        'subscription_data[trial_period_days]': '14',
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][plan]': plan,
      }),
    })

    const sessionText = await sessionRes.text()

    return new Response(JSON.stringify({ debug: sessionText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
