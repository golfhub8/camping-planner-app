// Annual Pro Membership signup page
// $29.99/year with 7-day free trial
// Using Stripe Checkout Sessions for secure, hosted payment experience
// Reference: blueprint:javascript_stripe

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon } from "lucide-react";

// Main Pro Membership signup page
export default function Subscribe() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const canceled = searchParams.get('canceled');

  // Check if user is authenticated
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false, // Don't retry if auth fails
  });

  useEffect(() => {
    if (canceled) {
      toast({
        title: "Signup Canceled",
        description: "You can try again when you're ready.",
        variant: "destructive",
      });
    }
  }, [canceled]);

  const handleSubscribe = async () => {
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", {});
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Network error" }));
        
        // Handle 409 Conflict - user already has an active subscription
        if (response.status === 409 && errorData.portalUrl) {
          toast({
            title: "Already subscribed",
            description: "You already have an active subscription. Redirecting to your billing portal...",
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
          window.location.href = errorData.portalUrl;
          return;
        }
        
        throw new Error(errorData.error || "Failed to create checkout session");
      }
      
      const data = await response.json();
      
      if (data.url) {
        // Show toast before redirecting
        toast({
          title: "Redirecting to checkout...",
          description: "You'll be redirected to Stripe's secure payment page",
        });
        
        // Small delay to ensure toast is visible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned from server");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error Starting Checkout",
        description: error.message || "Unable to start checkout. Please refresh and try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Show loading skeleton only for initial load
  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background">
        
        <div className="container mx-auto px-6 md:px-10 py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="h-8 w-3/4 bg-muted animate-pulse rounded"></div>
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-4 bg-muted animate-pulse rounded"></div>
                <div className="h-4 bg-muted animate-pulse rounded"></div>
                <div className="h-4 bg-muted animate-pulse rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <div className="container mx-auto px-6 md:px-10 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Become a Pro Member</CardTitle>
                <CardDescription className="mt-2">
                  Get access to all printable camping planners and games
                </CardDescription>
              </div>
              <Badge variant="default" className="text-sm">
                7-Day Free Trial
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold">What's Included:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    All printable camping planners and games
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    New resources added regularly
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    High-quality PDF downloads
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    7-day free trial - cancel anytime before billing
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">How it works:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Start your 7-day free trial today</li>
                <li>Access all printables during your trial</li>
                <li>After 7 days, you'll be billed $29.99/year</li>
                <li>Cancel anytime before the trial ends for $0</li>
                <li>Subscription renews automatically every year until canceled</li>
              </ol>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-lg font-semibold">Annual Membership</span>
                <div className="text-right">
                  <span className="text-3xl font-bold">$29.99</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Billed annually. Renews automatically until canceled.
              </p>
              
              {!user ? (
                <Button 
                  onClick={() => window.location.href = '/api/login'}
                  disabled={isLoadingUser} 
                  className="w-full"
                  data-testid="button-login"
                  size="lg"
                >
                  {isLoadingUser ? "Loading..." : "Log In to Continue"}
                </Button>
              ) : (
                <Button 
                  onClick={handleSubscribe}
                  disabled={isLoading} 
                  className="w-full"
                  data-testid="button-subscribe"
                  size="lg"
                >
                  {isLoading ? "Redirecting to Checkout..." : "Start 7-Day Free Trial"}
                </Button>
              )}
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure payment powered by Stripe. Cancel anytime during trial for $0 charge. After the trial, your subscription will renew automatically every 12 months unless you cancel. Manage or cancel your subscription anytime from your account page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
