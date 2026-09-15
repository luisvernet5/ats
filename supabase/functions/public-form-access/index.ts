import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_TABLES = new Set(['evaluaciones_enviadas', 'procesos_enviados', 'solicitudes_empleo'])

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, table, token, data } = await req.json()

    if (!ALLOWED_TABLES.has(table)) throw new Error('Tabla no permitida')
    if (!token || typeof token !== 'string') throw new Error('Token requerido')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Siempre se localiza el registro por token primero — esto es lo que
    // impide que alguien lea o edite un registro sin conocer su token.
    const { data: rows, error: findErr } = await supabaseAdmin
      .from(table)
      .select('id,data')
      .filter('data->>token', 'eq', token)
      .limit(1)
    if (findErr) throw new Error(findErr.message)
    const row = rows?.[0]
    if (!row) throw new Error('No encontrado')

    if (action === 'get') {
      return new Response(
        JSON.stringify({ data: row.data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'submit') {
      if (!data || typeof data !== 'object') throw new Error('Datos inválidos')
      if (data.token !== token) throw new Error('Token inválido')
      const { error: updErr } = table === 'evaluaciones_enviadas'
        ? await supabaseAdmin.from(table).upsert({ id: row.id, data })
        : await supabaseAdmin.from(table).update({ data }).eq('id', row.id)
      if (updErr) throw new Error(updErr.message)
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Acción no soportada')
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
