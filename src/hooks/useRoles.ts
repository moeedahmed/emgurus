import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "guru" | "user";

export function useRoles() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<string[]>({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) return [];
      return (data || []).map((r: any) => r.role as string);
    },
    staleTime: 60_000,
  });

  const roles = (data ?? (user ? ["user"] : [])) as AppRole[];
  const primaryRole: AppRole | undefined = roles.includes("admin")
    ? "admin"
    : roles.includes("guru")
    ? "guru"
    : user
    ? "user"
    : undefined;

  return { roles, primaryRole, isLoading };
}
