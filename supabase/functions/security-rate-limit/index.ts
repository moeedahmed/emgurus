import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateLimitRequest {
  endpoint: string;
  maxRequestsPerMinute?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { endpoint, maxRequestsPerMinute = 60 }: RateLimitRequest = await req.json();
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';

    console.log(`Rate limit check for endpoint: ${endpoint}, IP: ${clientIP}, User: ${userId}`);

    // Check rate limit using database function
    const { data: isAllowed, error } = await supabase.rpc('check_rate_limit', {
      endpoint_name: endpoint,
      max_requests_per_minute: maxRequestsPerMinute
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed', allowed: true }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log rate limit result
    console.log(`Rate limit result for ${endpoint}: ${isAllowed ? 'allowed' : 'blocked'}`);

    return new Response(
      JSON.stringify({ 
        allowed: isAllowed,
        endpoint,
        maxRequestsPerMinute,
        timestamp: new Date().toISOString()
      }),
      { 
        status: isAllowed ? 200 : 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Rate limiting error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', allowed: true }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});