import { useQuery } from "@tanstack/react-query";

export type SubscriptionPlan = 'free' | 'trial' | 'pro';

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  current_period_end: string | null;
  status: string | null;
}

export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/billing/subscription-status"],
    staleTime: 1000 * 60 * 5,
  });
}
