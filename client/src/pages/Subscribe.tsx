// Monthly subscription page for recurring printable access
// Now using Stripe Checkout Sessions for a more secure, hosted payment experience
// Reference: blueprint:javascript_stripe

import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon } from "lucide-react";

// Main subscribe page component
export default function Subscribe() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (canceled) {
      toast({
        title: "Subscription Canceled",
        description: "You can try again when you're ready.",
        variant: "destructive",
      });
    }
  }, [canceled]);

  const handleSubscribe = async () => {
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/billing/create-subscription-checkout", {});
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start subscription. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Monthly Subscription</CardTitle>
            <CardDescription>
              Get access to all printable camping planners and games with a monthly subscription
            </CardDescription>
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
                    New resources added each month
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
                    Cancel anytime - no commitments
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-lg font-semibold">Monthly</span>
                <div className="text-right">
                  <span className="text-3xl font-bold">$9.99</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
              </div>
              
              <Button 
                onClick={handleSubscribe}
                disabled={isLoading} 
                className="w-full"
                data-testid="button-subscribe"
                size="lg"
              >
                {isLoading ? "Redirecting to Checkout..." : "Subscribe for $9.99/month"}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure payment powered by Stripe. You'll be redirected to complete your subscription. Cancel anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
