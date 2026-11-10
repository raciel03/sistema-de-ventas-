// Consultar RUC - Decolecta API (migrada desde apis.net.pe)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const appUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const consultaUrl = Deno.env.get('CONSULTA_PERU_URL') ?? 'https://api.decolecta.com/v1/sunat/ruc'
const consultaToken = Deno.env.get('CONSULTA_PERU_TOKEN') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, message: 'Metodo no permitido. Usa POST.' }, 405)

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ ok: false, message: 'Falta el token de sesion.' }, 401)
    const lector = createClient(appUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: quien, error: errToken } = await lector.auth.getUser(token)
    if (errToken || !quien?.user) return json({ ok: false, message: 'Sesion invalida o vencida.' }, 401)

    const { ruc } = await req.json().catch(() => ({ ruc: '' }))
    const limpio = String(ruc ?? '').replace(/\D/g, '')
    if (limpio.length !== 11) return json({ ok: false, message: 'El RUC debe tener 11 digitos.' }, 400)
    if (!consultaUrl || !consultaToken) {
      return json({ ok: false, message: 'Consulta de RUC no configurada (secrets CONSULTA_PERU_URL / CONSULTA_PERU_TOKEN).' }, 500)
    }

    // Decolecta: GET con Authorization Bearer y parametro ?numero=
    const destino = new URL(consultaUrl)
    destino.searchParams.set('numero', limpio)
    const resp = await fetch(destino.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${consultaToken}`, Accept: 'application/json' },
    })
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>
    const razonSocial = String(raw?.razon_social ?? '')

    if (!resp.ok || !razonSocial) {
      let message: string
      if (resp.status === 401 || resp.status === 403) {
        message = 'Token de consulta invalido o vencido. Renuevalo en decolecta.com.'
      } else if (resp.status === 404 || resp.status === 422) {
        message = 'RUC no encontrado o sin datos en SUNAT.'
      } else {
        message = `El proveedor de RUC respondio ${resp.status}. Intentalo de nuevo.`
      }
      // 200 + ok:false para que la app muestre el motivo real del proveedor.
      return json({ ok: false, message }, 200)
    }

    return json({
      ok: true,
      data: {
        ruc: limpio,
        razonSocial,
        nombreComercial: String(raw?.nombre_comercial ?? '') || undefined,
        direccion: String(raw?.direccion ?? '') || undefined,
        estado: String(raw?.estado ?? '') || undefined,
        condicion: String(raw?.condicion ?? '') || undefined,
        ubigeo: String(raw?.ubigeo ?? '') || undefined,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno al consultar RUC.'
    return json({ ok: false, message: msg }, 200)
  }
})