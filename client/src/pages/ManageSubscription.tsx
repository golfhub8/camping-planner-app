import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ManageSubscription() {
  const [isRedirecting, setIsRedirecting] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const redirectToPortal = async () => {
      try {
        const response = await fetch("/api/billing/portal", {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No portal URL received");
        }
      } catch (error) {
        console.error("Error creating portal session:", error);
        setIsRedirecting(false);
        toast({
          title: "Error",
          description: "Failed to open subscription management. Please try again.",
          variant: "destructive",
        });
      }
    };

    redirectToPortal();
  }, [toast]);

  return (
    <div className="container mx-auto px-6 md:px-10 py-8 max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" data-testid="loader-redirecting" />
          <h2 className="text-xl font-semibold mb-2">Redirecting to Stripe</h2>
          <p className="text-muted-foreground text-center">
            {isRedirecting 
              ? "Please wait while we redirect you to manage your subscription..."
              : "Unable to redirect. Please try again."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
