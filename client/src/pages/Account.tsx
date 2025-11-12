import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CreditCard, Package, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

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

export default function Account() {
  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/me"],
  });

  const getTrialDaysRemaining = () => {
    if (!user?.isTrialing || !user?.periodEnd) return null;
    const endDate = new Date(user.periodEnd);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  const getPlanStatus = () => {
    if (user?.isTrialing) return "Trial";
    if (user?.isPro) return "Pro";
    return "Free";
  };

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
      const response = await fetch("/api/billing/portal", {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
    }
  };

  if (isLoading) {
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

  if (!user) {
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
              <Badge variant={user.isPro ? "default" : "secondary"} className="text-base px-4 py-1" data-testid="badge-plan-status">
                {getPlanStatus()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.isTrialing && trialDaysRemaining !== null && (
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

            {user.isPro && !user.isTrialing && user.periodEnd && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Renewal Date</span>
                <span className="font-medium" data-testid="text-renewal-date">{formatDate(user.periodEnd)}</span>
              </div>
            )}

            {!user.isPro && (
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Upgrade to Pro to unlock unlimited trips, printable planners, and exclusive camping resources.
                </p>
                <Link href="/printables?upgrade=trial">
                  <Button variant="default" data-testid="button-start-trial">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            )}

            {user.stripeCustomerId && (
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
          </CardContent>
        </Card>

        <Card data-testid="card-trip-stats">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Trip Statistics
            </CardTitle>
            <CardDescription>Your camping trip activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Total Trips Created</span>
              <span className="text-2xl font-bold" data-testid="text-trips-count">{user.tripsCount}</span>
            </div>
            {!user.isPro && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="text-muted-foreground">
                  Free plan: <span className="font-semibold">{user.tripsCount}/5 trips</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-account-info">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
