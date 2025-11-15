import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  testId?: string;
}

export default function FloatingActionButton({ 
  onClick, 
  label = "Add", 
  className,
  testId = "fab-button"
}: FloatingActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "md:hidden fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        className
      )}
      data-testid={testId}
      aria-label={label}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
