import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { tier, mode } = await req.json();
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }

    // Define tier pricing
    const pricing = {
      exam: { amount: 2999, name: "Exam Access" }, // $29.99
      consultation: { amount: 4999, name: "Consultation Access" }, // $49.99
      premium: { amount: 9999, name: "Premium Access" } // $99.99
    };

    const tierData = pricing[tier as keyof typeof pricing];
    if (!tierData) throw new Error("Invalid tier");

    let sessionConfig;
    
    if (mode === 'subscription') {
      // Create subscription
      sessionConfig = {
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `${tierData.name} - Monthly` },
              unit_amount: tierData.amount,
              recurring: { interval: "month" }
            },
            quantity: 1,
          },
        ],
        mode: "subscription" as const,
        success_url: `${req.headers.get("origin")}/dashboard?success=true`,
        cancel_url: `${req.headers.get("origin")}/pricing`,
      };
    } else {
      // One-time payment
      sessionConfig = {
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `${tierData.name} - One Time` },
              unit_amount: tierData.amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment" as const,
        success_url: `${req.headers.get("origin")}/dashboard?success=true`,
        cancel_url: `${req.headers.get("origin")}/pricing`,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Store subscription info
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    await supabaseService.from("subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: session.id,
      tier: tier,
      status: "pending"
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});