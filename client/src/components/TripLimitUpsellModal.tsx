import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Tent, Sparkles } from "lucide-react";

interface TripLimitUpsellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TripLimitUpsellModal({ open, onOpenChange }: TripLimitUpsellModalProps) {
  const [, setLocation] = useLocation();

  const handleStartTrial = () => {
    onOpenChange(false);
    setLocation("/subscribe");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-trip-limit-upsell">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
            <Tent className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">You've Reached Your Trip Limit</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Free accounts are limited to 5 trips. Start your free 7-day trial to create unlimited trips and unlock premium features!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Unlimited Trips</p>
                <p className="text-sm text-muted-foreground">Create as many camping trips as you want</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Printable Planners</p>
                <p className="text-sm text-muted-foreground">Access exclusive camping checklists and games</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Premium Support</p>
                <p className="text-sm text-muted-foreground">Get priority help when you need it</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button 
            onClick={handleStartTrial} 
            className="w-full"
            data-testid="button-start-free-trial"
          >
            Start Free Trial
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
            data-testid="button-maybe-later"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
