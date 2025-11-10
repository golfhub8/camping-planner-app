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
import Header from "@/components/Header";

// Main Pro Membership signup page
export default function Subscribe() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const canceled = searchParams.get('canceled');

  // Check if user is authenticated
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/auth/user'],
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
    console.log("Starting Pro membership signup...");

    try {
      console.log("Sending API request...");
      const response = await apiRequest("POST", "/api/billing/create-checkout-session", {});
      console.log("Response status:", response.status);
      
      const data = await response.json();
      console.log("Response data:", data);
      
      if (data.url) {
        console.log("Redirecting to:", data.url);
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start Pro membership signup. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
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
              </ol>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-lg font-semibold">Annual Membership</span>
                <div className="text-right">
                  <span className="text-3xl font-bold">$29.99</span>
                  <span className="text-sm text-muted-foreground">/year</span>
                </div>
              </div>
              
              {!user ? (
                <Button 
                  onClick={() => window.location.href = '/api/auth/login'}
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
                Secure payment powered by Stripe. Cancel anytime during trial for $0 charge.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
