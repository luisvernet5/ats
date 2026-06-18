import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const { email, redirectTo, nombre, rol, empresa_id, reclutador_id } = await req.json()

    if (!email) throw new Error('El email es requerido')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Try to invite; if user already exists in Auth, look up their ID instead
    let userId: string | null = null
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo: redirectTo || 'https://ats-five-black.vercel.app/ats-tracker-v2.html' }
    )

    if (inviteError) {
      // User might already exist — search by email
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) throw new Error('No se pudo invitar: ' + inviteError.message)
      const existing = listData?.users?.find((u: any) => u.email === email)
      if (!existing) throw new Error(inviteError.message)
      userId = existing.id
    } else {
      userId = inviteData?.user?.id ?? null
    }

    // Upsert into usuarios table
    if (userId) {
      const { error: upsertError } = await supabaseAdmin
        .from('usuarios')
        .upsert({
          id: userId,
          nombre: nombre || email,
          email,
          rol: rol || 'reclutador',
          empresa_id: empresa_id || null,
          reclutador_id: reclutador_id || null,
          activo: true,
        })
      if (upsertError) throw new Error('Usuario invitado pero error al registrar: ' + upsertError.message)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
