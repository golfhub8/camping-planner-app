// Monthly subscription page for recurring printable access
// Reference: blueprint:javascript_stripe

import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

// Load Stripe with public key (only if available)
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Subscribe form component
function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/printables?subscription=success',
      },
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        data-testid="button-submit-subscription"
      >
        {isProcessing ? "Processing..." : "Subscribe for $9.99/month"}
      </Button>
    </form>
  );
}

// Main subscribe page component
export default function Subscribe() {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if Stripe is configured
    if (!stripePromise) {
      setIsLoading(false);
      return;
    }

    // Create or retrieve subscription
    apiRequest("POST", "/api/create-subscription", {})
      .then((res: any) => res.json())
      .then((data: any) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          // User already has an active subscription
          toast({
            title: "Already Subscribed",
            description: "You already have an active subscription!",
          });
          setTimeout(() => window.location.href = '/printables', 2000);
        }
        setIsLoading(false);
      })
      .catch((error: any) => {
        toast({
          title: "Error",
          description: error.message || "Failed to initialize subscription. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  // Show message if Stripe is not configured
  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Subscription Not Available</CardTitle>
            <CardDescription>
              Payment processing is not configured yet. Please contact the site administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Subscription Error</CardTitle>
            <CardDescription>
              Unable to initialize subscription. Please try again or contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
          <CardContent>
            <div className="mb-6 space-y-2">
              <h3 className="font-semibold">What's Included:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>All printable camping planners and games</li>
                <li>New resources added each month</li>
                <li>High-quality PDF downloads</li>
                <li>Cancel anytime - no commitments</li>
              </ul>
              <p className="text-sm text-muted-foreground pt-4">
                Only $9.99/month - save vs. lifetime access if you only need short-term access
              </p>
            </div>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <SubscribeForm />
            </Elements>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
