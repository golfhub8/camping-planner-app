import { queryClient } from "@/lib/queryClient";

export function useLogout() {
  const handleLogout = () => {
    // Clear React Query cache to remove user data
    queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
    
    // Redirect to server logout endpoint (which handles OIDC logout)
    window.location.href = "/api/logout";
  };

  return { handleLogout };
}
