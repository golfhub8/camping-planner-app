// One-time payment page for lifetime printable access
// Now using Stripe Checkout Sessions for a more secure, hosted payment experience
// Reference: blueprint:javascript_stripe

import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { CheckCircle2Icon } from "lucide-react";

// Main checkout page component
export default function Checkout() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (canceled) {
      toast({
        title: "Payment Canceled",
        description: "You can try again when you're ready.",
        variant: "destructive",
      });
    }
  }, [canceled]);

  const handleCheckout = async () => {
    setIsLoading(true);
    console.log("Starting checkout...");

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
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout. Please try again.",
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
            <CardTitle className="text-2xl">Purchase Lifetime Access</CardTitle>
            <CardDescription>
              Get unlimited access to all printable camping planners and games forever
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold">What's Included:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    All current printable camping planners and games
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Future printable resources added to the library
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
                    No recurring fees - pay once, access forever
                  </span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-3xl font-bold">$29.99</span>
              </div>
              
              <Button 
                onClick={handleCheckout}
                disabled={isLoading} 
                className="w-full"
                data-testid="button-checkout"
                size="lg"
              >
                {isLoading ? "Redirecting to Checkout..." : "Purchase Lifetime Access"}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground mt-4">
                Secure payment powered by Stripe. You'll be redirected to complete your purchase.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
