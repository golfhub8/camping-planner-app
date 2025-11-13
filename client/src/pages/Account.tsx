import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard, Package, AlertCircle, Check, Mail, TrendingUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import SubscribeButton from "@/components/SubscribeButton";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  email: string;
  firstName: string | null;
  lastName: string | null;
  isPro: boolean;
  isTrialing: boolean;
  periodEnd: string | null;
  proMembershipEndDate: string | null;
  tripsCount: number;
  stripeCustomerId: string | null;
}

interface UsageStats {
  tripsCount: number;
  mealsCount: number;
  groceryListsCount: number;
}

interface AccountPlan {
  plan: 'free' | 'pro';
  tripLimit: number | null;
  groceryLimit: number | null;
  hasStripeCustomer: boolean;
  subscriptionStatus: string | null;
  membershipEndDate: string | null;
}

export default function Account() {
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/me"],
  });

  const { data: accountPlan, isLoading: planLoading, refetch: refetchPlan } = useQuery<AccountPlan>({
    queryKey: ["/api/account/plan"],
  });

  const { data: usage } = useQuery<UsageStats>({
    queryKey: ["/api/usage/stats"],
  });

  // Handle return from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    
    if (status === 'success') {
      // Sync subscription status from Stripe before showing success
      const syncSubscription = async () => {
        try {
          const response = await fetch('/api/billing/sync-subscription', {
            method: 'POST',
            credentials: 'include',
          });
          
          if (response.ok) {
            console.log('Subscription synced successfully');
          } else {
            console.error('Failed to sync subscription');
          }
        } catch (error) {
          console.error('Error syncing subscription:', error);
        } finally {
          // Invalidate auth query to update Pro status in navbar immediately
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          // Also refetch plan data and show success toast
          refetchPlan();
          toast({
            title: "Welcome to Pro!",
            description: "Your subscription is now active. Enjoy unlimited access to all features.",
          });
        }
      };
      
      syncSubscription();
      // Clean up URL
      window.history.replaceState({}, '', '/account');
    } else if (status === 'cancel') {
      toast({
        title: "Checkout Canceled",
        description: "No charges were made. You can subscribe anytime.",
        variant: "default",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/account');
    }
  }, [location, refetchPlan, toast]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleManageSubscription = async () => {
    try {
      // Create portal session on-demand
      const response = await fetch("/api/billing/portal", {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast({
        title: "Error",
        description: "Unable to open billing portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Show loading state while fetching user or plan data
  if (isLoading || planLoading) {
    return (
      <div className="container mx-auto px-6 md:px-10 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Ensure both user and plan data are loaded
  if (!user || !accountPlan) {
    return (
      <div className="container mx-auto px-6 md:px-10 py-8 max-w-4xl">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">Unable to load account information</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Compute plan-derived values after data is loaded
  const isPro = accountPlan.plan === 'pro';
  const isTrialing = accountPlan.subscriptionStatus === 'trialing';

  const getTrialDaysRemaining = () => {
    if (!isTrialing || !accountPlan.membershipEndDate) return null;
    const endDate = new Date(accountPlan.membershipEndDate);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  const getPlanStatus = () => {
    if (isTrialing) return "Pro Trial";
    if (isPro) return "Pro";
    return "Free";
  };

  const trialDaysRemaining = getTrialDaysRemaining();

  return (
    <div className="container mx-auto px-6 md:px-10 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-account-title">My Account</h1>
          <p className="text-muted-foreground mt-1">Manage your account and subscription</p>
        </div>

        <Card data-testid="card-plan-info">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription Plan
                </CardTitle>
                <CardDescription className="mt-1">Your current plan and billing information</CardDescription>
              </div>
              <Badge variant={isPro ? "default" : "secondary"} className="text-base px-4 py-1" data-testid="badge-plan-status">
                {planLoading ? "Loading..." : getPlanStatus()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTrialing && trialDaysRemaining !== null && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-primary">Trial Active</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-trial-days">
                      {trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} remaining
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isPro && !isTrialing && accountPlan?.membershipEndDate && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Renewal Date</span>
                <span className="font-medium" data-testid="text-renewal-date">{formatDate(accountPlan.membershipEndDate)}</span>
              </div>
            )}

            {!isPro && (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Upgrade to Pro to unlock unlimited trips, printable planners, and exclusive camping resources.
                </p>
                <SubscribeButton label="Start 7-Day Free Trial" />
              </div>
            )}

            {accountPlan?.hasStripeCustomer && (
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  data-testid="button-manage-subscription"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Subscription
                </Button>
              </div>
            )}

            <Separator className="my-4" />

            <div>
              <h3 className="font-semibold mb-3">Plan Benefits</h3>
              {isPro ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-unlimited-trips">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Unlimited trips</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-unlimited-grocery">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Unlimited grocery lists</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-all-printables">
                    <Check className="h-4 w-4 text-primary" />
                    <span>All printables & games</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-full-packing-checklists">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Full packing checklists</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-priority-updates">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Priority updates</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-limited-trips">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Up to {accountPlan?.tripLimit || 5} trips</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-limited-grocery">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Up to {accountPlan?.groceryLimit || 5} grocery lists</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" data-testid="benefit-free-printables">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Free printables</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-usage-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Statistics
            </CardTitle>
            <CardDescription>Your activity on The Camping Planner</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold" data-testid="stat-trips">
                  {usage?.tripsCount ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Trips Planned</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold" data-testid="stat-meals">
                  {usage?.mealsCount ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Meals Added</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold" data-testid="stat-grocery-lists">
                  {usage?.groceryListsCount ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Grocery Lists Generated</p>
              </div>
            </div>
            {!isPro && (
              <div className="bg-muted rounded-lg p-3 text-sm mt-4">
                <p className="text-muted-foreground">
                  Free plan: <span className="font-semibold">{user?.tripsCount ?? 0}/5 trips</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-account-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your profile details and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="font-medium" data-testid="text-email">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="font-medium" data-testid="text-name">
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user.firstName || user.lastName || "Not set"}
              </span>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => setResetPasswordDialogOpen(true)}
                data-testid="button-reset-password"
              >
                Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent data-testid="dialog-reset-password">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              To reset your password, please contact support at support@thecampingplanner.com
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Our support team will guide you through the password reset process securely.
            </p>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialogOpen(false)}
              className="w-full"
              data-testid="button-close-reset-dialog"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
