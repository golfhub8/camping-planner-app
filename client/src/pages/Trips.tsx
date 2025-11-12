import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTripSchema, type Trip, type InsertTrip } from "@shared/schema";
import EditTripDialog from "@/components/EditTripDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, PencilIcon } from "lucide-react";
import { format, isValid } from "date-fns";
import { useLocation } from "wouter";

export default function Trips() {
  const [, navigate] = useLocation();
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  
  // Fetch all trips from the API
  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  // Form for creating a new trip
  const form = useForm<InsertTrip>({
    resolver: zodResolver(insertTripSchema),
    defaultValues: {
      name: "",
      location: "",
      startDate: undefined as any,
      endDate: undefined as any,
    },
  });

  // Mutation for creating a new trip
  const createTripMutation = useMutation({
    mutationFn: async (newTrip: InsertTrip) => {
      const response = await apiRequest("POST", "/api/trips", {
        name: newTrip.name,
        location: newTrip.location,
        // Convert to ISO strings for the API (startDate and endDate are Date objects from the form)
        startDate: newTrip.startDate.toISOString(),
        endDate: newTrip.endDate.toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch trips after creating a new one
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      form.reset();
    },
  });

  const handleCreateTrip = (data: InsertTrip) => {
    createTripMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading trips...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto px-6 md:px-10 py-12 space-y-10">
        {/* Page Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-foreground" data-testid="text-page-title">
            Camping Trips
          </h1>
          <p className="text-muted-foreground" data-testid="text-trip-count">
            {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
          </p>
        </div>

        {/* Create Trip Form */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Plan a New Trip</CardTitle>
            <CardDescription>
              Set up a camping trip with dates and location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateTrip)} className="space-y-4">
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
                            data-testid="input-trip-name"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Goldstream Provincial Park" 
                            data-testid="input-trip-location"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            data-testid="input-trip-start-date"
                            value={field.value instanceof Date && isValid(field.value) ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              // Store the exact Date object from the input value
                              // The date string is in YYYY-MM-DD format (ISO date, not datetime)
                              const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                              field.onChange(date);
                            }}
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
                            data-testid="input-trip-end-date"
                            value={field.value instanceof Date && isValid(field.value) ? format(field.value, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              // Store the exact Date object from the input value
                              // The date string is in YYYY-MM-DD format (ISO date, not datetime)
                              const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                              field.onChange(date);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={createTripMutation.isPending}
                  data-testid="button-create-trip"
                >
                  {createTripMutation.isPending ? "Creating..." : "Create Trip"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Trips List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Your Trips</h2>
          
          {trips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No trips yet. Plan your first camping adventure above!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => {
                // Calculate number of people for cost splitting
                const peopleCount = (trip.collaborators?.length || 0) + 1;
                const costPerPerson = trip.costTotal 
                  ? parseFloat(trip.costTotal) / peopleCount 
                  : 0;

                return (
                  <Card 
                    key={trip.id} 
                    className="hover-elevate active-elevate-2 transition-all"
                    data-testid={`card-trip-${trip.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => navigate(`/trips/${trip.id}`)}
                        >
                          <CardTitle data-testid={`text-trip-name-${trip.id}`}>
                            {trip.name}
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTrip(trip);
                          }}
                          data-testid={`button-edit-trip-${trip.id}`}
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      {trip.location && (
                        <CardDescription className="flex items-center gap-1">
                          <MapPinIcon className="w-4 h-4" />
                          {trip.location}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent 
                      className="space-y-3 cursor-pointer"
                      onClick={() => navigate(`/trips/${trip.id}`)}
                    >
                      {/* Dates */}
                      {trip.startDate && trip.endDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="w-4 h-4" />
                          <span>
                            {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}

                      {/* Collaborators */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UsersIcon className="w-4 h-4" />
                        <span>
                          {trip.collaborators && trip.collaborators.length > 0 
                            ? `${peopleCount} people` 
                            : 'Solo trip'}
                        </span>
                      </div>

                      {/* Collaborators List */}
                      {trip.collaborators && trip.collaborators.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {trip.collaborators.map((collaborator, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {collaborator}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Cost Information */}
                      {trip.costTotal && (
                        <div className="pt-3 border-t space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <DollarSignIcon className="w-4 h-4" />
                            <span>Total: ${parseFloat(trip.costTotal).toFixed(2)}</span>
                          </div>
                          {peopleCount > 1 && (
                            <p className="text-xs text-muted-foreground pl-6">
                              ${costPerPerson.toFixed(2)} per person
                            </p>
                          )}
                          {trip.costPaidBy && (
                            <p className="text-xs text-muted-foreground pl-6">
                              Paid by: {trip.costPaidBy}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Meals Count */}
                      {trip.meals && trip.meals.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {trip.meals.length} meal{trip.meals.length !== 1 ? 's' : ''} planned
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Edit Trip Dialog */}
      {editingTrip && (
        <EditTripDialog
          trip={editingTrip}
          open={editingTrip !== null}
          onOpenChange={(open) => {
            if (!open) setEditingTrip(null);
          }}
        />
      )}
    </div>
  );
}
