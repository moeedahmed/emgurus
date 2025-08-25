/**
 * Shared response utility for consistent API responses across edge functions
 */

/**
 * Success response helper that ensures consistent { success: true, ...data } envelope
 */
export function ok(data: Record<string, any> = {}, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Error response helper that ensures consistent { success: false, error } envelope
 */
export function fail(error: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Success response with CORS headers
 */
export function okWithCors(data: Record<string, any> = {}, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Error response with CORS headers
 */
export function failWithCors(error: string, corsHeaders: Record<string, string>, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}