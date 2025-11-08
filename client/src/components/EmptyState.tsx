import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="empty-state">
      <div className="rounded-full bg-muted p-6 mb-4">
        <ChefHat className="h-12 w-12 text-muted-foreground" />
      </div>
      <p className="text-lg text-muted-foreground mb-6" data-testid="text-empty-message">
        {message}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} data-testid="button-empty-action">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
