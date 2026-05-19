import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      reclutador_email,
      reclutador_nombre,
      vacante_nombre,
      empresa_nombre,
      fecha_apertura,
      salario,
      descripcion
    } = await req.json()

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2AAADE; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">ATS Tracker</h1>
        </div>
        <div style="padding: 30px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Hola ${reclutador_nombre},</h2>
          <p style="color: #555;">Se te ha asignado una nueva vacante:</p>
          <div style="background: white; border-left: 4px solid #2AAADE;
                      padding: 20px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #888; width: 40%;">
                  <strong>Puesto:</strong>
                </td>
                <td style="padding: 8px 0; color: #333;">
                  ${vacante_nombre}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888;">
                  <strong>Empresa:</strong>
                </td>
                <td style="padding: 8px 0; color: #333;">
                  ${empresa_nombre}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888;">
                  <strong>Fecha de apertura:</strong>
                </td>
                <td style="padding: 8px 0; color: #333;">
                  ${fecha_apertura}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888;">
                  <strong>Salario ofertado:</strong>
                </td>
                <td style="padding: 8px 0; color: #333;">
                  ${salario ? '$' + Number(salario).toLocaleString('es-MX') : 'Por definir'}
                </td>
              </tr>
            </table>
            ${descripcion ? `
            <div style="margin-top: 15px; padding-top: 15px;
                        border-top: 1px solid #eee;">
              <strong style="color: #888;">Descripción del perfil:</strong>
              <p style="color: #333; margin-top: 8px;">${descripcion}</p>
            </div>` : ''}
          </div>
          <div style="text-align: center; margin-top: 25px;">
            <a href="https://ats-five-black.vercel.app/ats-tracker-v2.html"
               style="background-color: #2AAADE; color: white;
                      padding: 12px 30px; text-decoration: none;
                      border-radius: 5px; font-weight: bold;">
              Ver en ATS Tracker
            </a>
          </div>
        </div>
        <div style="padding: 15px; text-align: center;
                    background-color: #eee; color: #888; font-size: 12px;">
          ATS Tracker — Sistema de seguimiento de candidatos
        </div>
      </div>
    `

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: reclutador_email }] }],
        from: { email: 'luis@kdc.com.mx', name: 'ATS Tracker' },
        subject: `Nueva vacante asignada: ${vacante_nombre} — ${empresa_nombre}`,
        content: [{ type: 'text/html', value: emailHtml }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(errText)
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
