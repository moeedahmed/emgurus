import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeSecretKey || !webhookSecret) {
      console.error("Missing required environment variables");
      return new Response("Configuration error", { status: 500, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    
    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    console.log(`Processing event: ${event.type} (${event.id})`);

    // Create Supabase service client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check for idempotency - insert event_id into billing_webhook_events
    const { error: idempotencyError } = await supabase
      .from("billing_webhook_events")
      .insert({
        event_id: event.id,
        type: event.type,
        payload: event
      });

    if (idempotencyError) {
      if (idempotencyError.code === "23505") { // Unique constraint violation
        console.log(`Event ${event.id} already processed, skipping`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      console.error("Error recording webhook event:", idempotencyError);
      return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }

    // Process the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Processing checkout.session.completed: ${session.id}`);
        
        if (session.mode === "subscription" && session.subscription && session.customer) {
          // Get user_id from session metadata
          const userId = session.metadata?.user_id;
          if (!userId) {
            console.error("No user_id in session metadata");
            break;
          }

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          
          // Determine tier from amount
          const amount = subscription.items.data[0]?.price?.unit_amount || 0;
          let tier = "exam";
          if (amount >= 14900) tier = "premium";
          else if (amount >= 7900) tier = "consults";

          // UPSERT subscription
          const { error: subError } = await supabase
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: subscription.id,
              tier: tier,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }, { onConflict: "user_id" });

          if (subError) {
            console.error("Error upserting subscription:", subError);
          } else {
            console.log(`Subscription activated for user ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Processing subscription.updated: ${subscription.id}`);
        
        // Find subscription by stripe_subscription_id
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (existingSub) {
          // Determine tier from amount
          const amount = subscription.items.data[0]?.price?.unit_amount || 0;
          let tier = "exam";
          if (amount >= 14900) tier = "premium";
          else if (amount >= 7900) tier = "consults";

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              tier: tier,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);

          if (updateError) {
            console.error("Error updating subscription:", updateError);
          } else {
            console.log(`Subscription updated: ${subscription.id}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Processing subscription.deleted: ${subscription.id}`);
        
        const { error: deleteError } = await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        if (deleteError) {
          console.error("Error canceling subscription:", deleteError);
        } else {
          console.log(`Subscription canceled: ${subscription.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
  }
});