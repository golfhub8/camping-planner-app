import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";
import { ExternalLinkIcon } from "lucide-react";

interface SubscribeButtonProps {
  label?: string;
  className?: string;
}

export default function SubscribeButton({
  label = "Go Pro",
  className = "",
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const [location] = useLocation();

  const handleClick = async () => {
    try {
      setLoading(true);
      console.log("[SubscribeButton] Starting checkout session...");
      
      const res = await fetch(apiUrl("/api/billing/create-checkout-session"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnPath: location }),
      });

      console.log("[SubscribeButton] Response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Network error" }));
        console.error("[SubscribeButton] Error response:", errorData);
        
        // Handle 409 Conflict - user already has an active subscription
        if (res.status === 409 && errorData.portalUrl) {
          console.log("[SubscribeButton] User already has subscription, redirecting to billing portal");
          toast({
            title: "Already subscribed",
            description: "You already have an active subscription. Redirecting to your billing portal...",
          });
          setTimeout(() => {
            window.location.href = errorData.portalUrl;
          }, 1000);
          return;
        }
        
        toast({
          title: "Error",
          description: errorData.error || "Failed to start checkout",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log("[SubscribeButton] Response data:", data);
      
      if (data?.url && typeof data.url === "string" && data.url.trim().length > 0) {
        console.log("[SubscribeButton] Redirecting to:", data.url);
        
        // Save URL for fallback link
        setCheckoutUrl(data.url);
        
        // Show toast while redirecting
        toast({
          title: "Redirecting to checkout...",
          description: "You'll be redirected to Stripe in a moment.",
        });
        
        // Redirect to Stripe checkout
        // Set a timeout to reset loading state if redirect is blocked/fails
        setTimeout(() => {
          setLoading(false);
        }, 3000);
        
        window.location.href = data.url;
      } else {
        console.error("[SubscribeButton] Invalid or missing URL in response:", data);
        toast({
          title: "Error",
          description: "No checkout URL returned from server",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (err) {
      console.error("[SubscribeButton] Checkout error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create checkout session",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="outline"
        size="sm"
        className={className}
        data-testid="button-subscribe-nav"
      >
        {loading ? "Redirecting..." : label}
      </Button>
      {checkoutUrl && (
        <button
          onClick={handleOpenInNewTab}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          data-testid="link-open-checkout-new-tab"
        >
          <ExternalLinkIcon className="w-3 h-3" />
          Open in new tab
        </button>
      )}
    </div>
  );
}
