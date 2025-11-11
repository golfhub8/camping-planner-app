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
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Network error" }));
        toast({
          title: "Error",
          description: errorData.error || "Failed to start checkout",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "No checkout URL returned",
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Error",
        description: "Failed to create checkout session",
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
