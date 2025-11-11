import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

interface TripSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrip: (tripId: number) => void;
  isLoading?: boolean;
}

export default function TripSelector({ open, onOpenChange, onSelectTrip, isLoading }: TripSelectorProps) {
  const { data: trips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: ["/api/trips"],
    enabled: open, // Only fetch when dialog is open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-trip-selector">
        <DialogHeader>
          <DialogTitle>Add to Trip</DialogTitle>
          <DialogDescription>
            Select which camping trip you want to add this recipe to
          </DialogDescription>
        </DialogHeader>

        {isLoadingTrips ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading trips...
          </div>
        ) : trips.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No trips yet. Create a trip first!
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {trips.map((trip: any) => (
                <Button
                  key={trip.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 hover-elevate"
                  onClick={() => onSelectTrip(trip.id)}
                  disabled={isLoading}
                  data-testid={`button-select-trip-${trip.id}`}
                >
                  <div className="flex flex-col items-start w-full gap-1">
                    <div className="font-semibold">{trip.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {trip.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(trip.startDate), "MMM d")} - {format(new Date(trip.endDate), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
