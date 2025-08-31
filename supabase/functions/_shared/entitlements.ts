import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface EntitlementResult {
  ok: boolean;
  status?: number;
  message?: string;
}

/**
 * Server-side entitlement guard - checks if user has active subscription with required tier
 * @param supabase - Supabase client (should use service role key for admin operations)
 * @param userId - User ID to check
 * @param allowed - Array of allowed subscription tiers (e.g., ['consults', 'premium'])
 * @returns {ok: true} if entitled, {ok: false, status: 403, message: string} if not
 */
export async function requireEntitlement(
  supabase: SupabaseClient,
  userId: string,
  allowed: string[]
): Promise<EntitlementResult> {
  try {
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("status, tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Entitlement check error:", error);
      return {
        ok: false,
        status: 403,
        message: "Unable to verify subscription status"
      };
    }

    // No subscription found
    if (!subscription) {
      return {
        ok: false,
        status: 403,
        message: "Requires active subscription"
      };
    }

    // Check if subscription is active
    const activeStatuses = ["active", "trialing"];
    if (!activeStatuses.includes(subscription.status)) {
      return {
        ok: false,
        status: 403,
        message: "Subscription is not active"
      };
    }

    // Check if tier is allowed
    if (!allowed.includes(subscription.tier)) {
      return {
        ok: false,
        status: 403,
        message: "Subscription tier does not include this feature"
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Entitlement check failed:", error);
    return {
      ok: false,
      status: 403,
      message: "Unable to verify subscription status"
    };
  }
}