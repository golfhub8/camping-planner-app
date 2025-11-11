import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SubscribeButtonProps {
  label?: string;
  className?: string;
}

export default function SubscribeButton({
  label = "Go Pro",
  className = "",
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    try {
      setLoading(true);
      console.log("[SubscribeButton] Starting checkout session...");
      
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
      });

      console.log("[SubscribeButton] Response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Network error" }));
        console.error("[SubscribeButton] Error response:", errorData);
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
        // Redirect to Stripe checkout
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

  return (
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
  );
}
