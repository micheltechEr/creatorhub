import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { api } from "@/lib/api";

export interface CurrentUser {
  id: string;
  role: "superadmin" | "artist" | "client";
  email: string;
  name: string;
  tenantId: string | null;
  tenant: {
    id: string;
    name: string;
    email: string;
    availability: boolean;
    isActive: boolean;
  } | null;
}

export const CURRENT_USER_QUERY_KEY = ["currentUser"] as const;

export function useCurrentUser() {
  const { isSignedIn, isLoaded } = useUser();

  return useQuery<CurrentUser>({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: () => api.get<CurrentUser>("/users/me"),
    enabled: !!(isLoaded && isSignedIn),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
