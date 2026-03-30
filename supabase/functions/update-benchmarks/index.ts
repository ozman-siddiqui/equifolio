import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROWS = new Set([
  'investor|Principal and Interest|<=80',
  'investor|Interest Only|<=80',
  'owner_occupier|Principal and Interest|<=80',
  'owner_occupier|Interest Only|<=80',
])

function buildKey(row: Record<string, unknown>) {
  return `${row.occupancy_type}|${row.repayment_type}|${row.lvr_band}`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_ANON_KEY') as string,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminEmail =
      Deno.env.get('VITE_ADMIN_EMAIL') || Deno.env.get('ADMIN_EMAIL') || ''

    if (!adminEmail || user.email !== adminEmail) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { rows } = await req.json()
    if (!Array.isArray(rows) || rows.length !== 4) {
      return new Response(JSON.stringify({ error: 'Expected exactly 4 benchmark rows' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    )

    const updatedRows = []

    for (const row of rows) {
      const key = buildKey(row)
      const benchmarkRate = Number(row?.benchmark_rate)

      if (!ALLOWED_ROWS.has(key) || Number.isNaN(benchmarkRate) || benchmarkRate < 3 || benchmarkRate > 12) {
        return new Response(JSON.stringify({ error: 'Invalid benchmark payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updatePayload = {
        benchmark_rate: benchmarkRate,
        effective_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
        source_name: 'manual-admin',
      }

      const { data, error } = await serviceClient
        .from('market_rate_benchmarks')
        .update(updatePayload)
        .eq('occupancy_type', row.occupancy_type)
        .eq('repayment_type', row.repayment_type)
        .eq('lvr_band', row.lvr_band)
        .select('occupancy_type, repayment_type, lvr_band, benchmark_rate, effective_date')
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      updatedRows.push(data)
    }

    return new Response(JSON.stringify({ rows: updatedRows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
