const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashSHA256(value) {
  const encoder = new TextEncoder()
  const data = encoder.encode(value.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const PIXEL_ID = Deno.env.get('META_PIXEL_ID')
    const ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN')
    const TEST_EVENT_CODE = Deno.env.get('META_TEST_EVENT_CODE')

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      throw new Error('Missing Meta credentials')
    }

    const { eventName, userEmail, userId, eventId, fbp, fbc } = await req.json()
    const hashedEmail = userEmail
      ? [await hashSHA256(userEmail)]
      : undefined

    const payload = {
      data: [
        {
          event_name: eventName,
          event_id: eventId || `${eventName}_${Date.now()}`,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: {
            em: hashedEmail,
            external_id: userId ? [userId] : undefined,
            fbp: fbp || undefined,
            fbc: fbc || undefined,
          },
        },
      ],
      test_event_code: TEST_EVENT_CODE || undefined,
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const result = await response.json()
    console.log('Meta CAPI response:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result?.error ? 500 : 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
