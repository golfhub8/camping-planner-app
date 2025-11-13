// Custom hook to check user authentication status
// Reference: blueprint:javascript_log_in_with_replit

import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
