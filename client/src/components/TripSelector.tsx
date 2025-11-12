import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, MapPin, Plus } from "lucide-react";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Trip } from "@shared/schema";

interface TripSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTrip: (tripId: number) => void;
  isLoading?: boolean;
}

const quickTripSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  location: z.string().min(1, "Location is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export default function TripSelector({ open, onOpenChange, onSelectTrip, isLoading }: TripSelectorProps) {
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const { toast } = useToast();
  
  const { data: trips = [], isLoading: isLoadingTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
    enabled: open, // Only fetch when dialog is open
  });

  const form = useForm<z.infer<typeof quickTripSchema>>({
    resolver: zodResolver(quickTripSchema),
    defaultValues: {
      name: "Weekend Camping Trip",
      location: "",
      startDate: addDays(new Date(), 7),
      endDate: addDays(new Date(), 9),
    },
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quickTripSchema>) => {
      const response = await apiRequest("POST", "/api/trips", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create trip");
      }
      return response.json();
    },
    onSuccess: (newTrip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Trip created!",
        description: `${newTrip.name} has been created.`,
      });
      setShowQuickCreate(false);
      form.reset();
      onSelectTrip(newTrip.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuickCreate = (data: z.infer<typeof quickTripSchema>) => {
    createTripMutation.mutate(data);
  };

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
          showQuickCreate ? (
            <div className="space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleQuickCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trip Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Weekend Camping Trip" data-testid="input-quick-trip-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Yellowstone National Park" data-testid="input-quick-trip-location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-quick-trip-start-date"
                              value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : field.value}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-quick-trip-end-date"
                              value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd") : field.value}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowQuickCreate(false)}
                      data-testid="button-cancel-quick-trip"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createTripMutation.isPending}
                      data-testid="button-create-quick-trip"
                    >
                      {createTripMutation.isPending ? "Creating..." : "Create Trip"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">
                No trips yet. Create your first trip to get started!
              </p>
              <Button
                onClick={() => setShowQuickCreate(true)}
                className="gap-2"
                data-testid="button-show-quick-create"
              >
                <Plus className="h-4 w-4" />
                Create Quick Trip
              </Button>
            </div>
          )
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {trips.map((trip) => (
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
