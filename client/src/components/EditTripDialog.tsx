import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { updateTripSchema, type UpdateTrip, type Trip } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface EditTripDialogProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTripDialog({ trip, open, onOpenChange }: EditTripDialogProps) {
  const { toast } = useToast();

  // Helper function to format date for input (YYYY-MM-DD)
  const formatDateForInput = (date: Date | string | undefined | null): string => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
    return format(dateObj, 'yyyy-MM-dd');
  };

  // Form for editing trip
  const form = useForm<UpdateTrip>({
    resolver: zodResolver(updateTripSchema),
    defaultValues: {
      name: trip.name,
      location: trip.location,
      startDate: trip.startDate as any,
      endDate: trip.endDate as any,
      lat: trip.lat ? parseFloat(trip.lat) : undefined,
      lng: trip.lng ? parseFloat(trip.lng) : undefined,
    },
  });

  // Reset form when trip data changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: trip.name,
        location: trip.location,
        startDate: trip.startDate as any,
        endDate: trip.endDate as any,
        lat: trip.lat ? parseFloat(trip.lat) : undefined,
        lng: trip.lng ? parseFloat(trip.lng) : undefined,
      });
    }
  }, [trip, open, form]);

  // Mutation for updating trip
  const updateTripMutation = useMutation({
    mutationFn: async (updates: UpdateTrip) => {
      // Build payload explicitly including lat/lng
      // Convert undefined to null because JSON.stringify removes undefined values
      const payload: any = {
        ...updates,
        // Convert Date objects to ISO strings for the API if they exist
        startDate: updates.startDate ? new Date(updates.startDate).toISOString() : undefined,
        endDate: updates.endDate ? new Date(updates.endDate).toISOString() : undefined,
        // Always include lat/lng, converting undefined/null to explicit null
        lat: updates.lat ?? null,
        lng: updates.lng ?? null,
      };
      
      const response = await apiRequest("PUT", `/api/trips/${trip.id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate trip queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "weather"] });
      
      toast({
        title: "Trip updated!",
        description: "Your trip details have been saved.",
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update trip",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: UpdateTrip) => {
    updateTripMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogDescription>
            Update your trip details. If you change the location or coordinates, the weather forecast will update automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Trip Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Goldstream Weekend"
                        data-testid="input-edit-trip-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location with Autocomplete */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <LocationAutocomplete
                        value={field.value || ''}
                        onChange={(location, lat, lng) => {
                          field.onChange(location);
                          form.setValue('lat', lat ?? null);
                          form.setValue('lng', lng ?? null);
                        }}
                        label="Location"
                        placeholder="e.g., Goldstream Provincial Park"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={formatDateForInput(field.value)}
                        onChange={(e) => {
                          const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                          field.onChange(dateValue);
                        }}
                        data-testid="input-edit-start-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={formatDateForInput(field.value)}
                        onChange={(e) => {
                          const dateValue = e.target.value ? new Date(e.target.value) : undefined;
                          field.onChange(dateValue);
                        }}
                        data-testid="input-edit-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Coordinates Display (Read-only - set via location autocomplete) */}
            {(() => {
              const lat = form.watch('lat');
              const lng = form.watch('lng');
              if (lat == null || lng == null) return null;
              
              return (
                <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
                  <div className="text-sm font-medium">Coordinates</div>
                  <div className="text-sm font-mono">
                    Latitude: {typeof lat === 'number' ? lat.toFixed(6) : lat}
                    <br />
                    Longitude: {typeof lng === 'number' ? lng.toFixed(6) : lng}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Coordinates are automatically set when you select a location from the autocomplete suggestions. They enable weather forecasts for this trip.
                  </p>
                </div>
              );
            })()}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTripMutation.isPending}
                data-testid="button-save-trip"
              >
                {updateTripMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
