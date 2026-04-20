import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('u')?.trim()
  const isUuid =
    !!userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (!userId || !isUuid) {
    return new Response(
      `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);text-align:center;">
      <h2 style="color:#0F172A;margin-bottom:12px;">Invalid unsubscribe link</h2>
      <p style="color:#475569;font-size:14px;">
        This link is not valid. Please contact support@nextiq.com.au
      </p>
    </div>
  </body>
</html>`,
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const { data, error } = await supabase
    .from('user_financial_profiles')
    .update({ alerts_opt_out: true })
    .eq('user_id', userId)
    .select()

  if (error) {
    return new Response(
      `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);text-align:center;">
      <h2 style="color:#0F172A;margin-bottom:12px;">Something went wrong</h2>
      <p style="color:#475569;font-size:14px;">
        Please contact support@nextiq.com.au to unsubscribe.
      </p>
    </div>
  </body>
</html>`,
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (!data || data.length === 0) {
    return new Response(
      `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);text-align:center;">
      <h2 style="color:#0F172A;margin-bottom:12px;">Invalid unsubscribe link</h2>
      <p style="color:#475569;font-size:14px;">
        This link is not valid. Please contact support@nextiq.com.au
      </p>
    </div>
  </body>
</html>`,
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  return new Response(
    `<!DOCTYPE html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f8fafc;margin:0;padding:40px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:28px 24px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);text-align:center;">
      <h2 style="color:#0F172A;margin-bottom:12px;">You have been unsubscribed</h2>
      <p style="color:#475569;font-size:14px;margin-bottom:16px;">
        You will no longer receive Nextiq portfolio alerts.
      </p>
      <p style="color:#64748b;font-size:13px;">
        If this was a mistake, you can re-enable alerts in your account settings at
        <a href="https://www.nextiq.com.au/settings" style="color:#1D9E75;text-decoration:underline;">
          nextiq.com.au/settings
        </a>
      </p>
    </div>
  </body>
</html>`,
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
  )
})
