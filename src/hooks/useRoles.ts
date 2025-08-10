import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "guru" | "user";

// Simple module-level cache to avoid repeated fetches across components
let cacheUserId: string | null = null;
let cacheRoles: AppRole[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function loadRoles(userId: string): Promise<AppRole[]> {
  if (cacheUserId === userId && cacheRoles && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cacheRoles;
  }
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    // return base role on error; don't throw to keep app responsive
    cacheUserId = userId;
    cacheRoles = ["user"];
    cacheTime = Date.now();
    return cacheRoles;
  }
  const roles = (data || []).map((r: any) => r.role as AppRole);
  cacheUserId = userId;
  cacheRoles = roles.length ? roles : ["user"];
  cacheTime = Date.now();
  console.debug("[useRoles] fetched roles from DB", cacheRoles);
  return cacheRoles;
}

export function useRoles() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery<AppRole[]>({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    // seed with cached value if valid to prevent refetch flashes
    initialData: user && cacheUserId === user.id && cacheRoles && Date.now() - cacheTime < CACHE_TTL_MS ? cacheRoles : undefined,
    queryFn: async () => {
      if (!user) return [];
      return loadRoles(user.id);
    },
    staleTime: CACHE_TTL_MS,
  });

  const roles = (data ?? (user ? ["user"] : [])) as AppRole[];
  const isAdmin = roles.includes("admin");
  const isGuru = roles.includes("guru") || isAdmin;
  const isUser = !!user;
  const primaryRole: AppRole | undefined = isAdmin ? "admin" : roles.includes("guru") ? "guru" : isUser ? "user" : undefined;

  return { roles, primaryRole, isUser, isGuru, isAdmin, isLoading, refetch };
}

