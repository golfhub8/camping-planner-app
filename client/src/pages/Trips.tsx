import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTripSchema, type Trip, type InsertTrip } from "@shared/schema";
import EditTripDialog from "@/components/EditTripDialog";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import SubscribeButton from "@/components/SubscribeButton";
import TripLimitUpsellModal from "@/components/TripLimitUpsellModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { format, isValid } from "date-fns";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Entitlements response type from backend
interface Entitlements {
  canCreateTrip: boolean;
  remainingTrips: number | null; // null = unlimited, number = trips remaining
  limit: number | null; // null for Pro, number for Free
  isPro: boolean;
  tripsCount: number;
}

export default function Trips() {
  const [, navigate] = useLocation();
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const { toast } = useToast();
  
  // Fetch user entitlements to check trip limits
  const { data: entitlements, isLoading: entitlementsLoading } = useQuery<Entitlements>({
    queryKey: ["/api/entitlements"],
  });
  
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
      lat: undefined,
      lng: undefined,
    },
  });

  // Mutation for creating a new trip with automatic retry on network errors
  const createTripMutation = useMutation({
    mutationFn: async (newTrip: InsertTrip) => {
      // Guard against missing dates (should be caught by form validation, but adding safety)
      if (!newTrip.startDate || !newTrip.endDate) {
        throw new Error("Start and end dates are required");
      }

      // Retry logic: attempt up to 3 times on network errors
      // Do NOT retry on validation errors (4xx status codes) or paywall errors
      let lastError: Error | null = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Reset status code for this attempt (prevents carryover from previous attempt)
        let statusCode: number | null = null;
        
        try {
          const response = await apiRequest("POST", "/api/trips", {
            name: newTrip.name,
            location: newTrip.location,
            // Convert to ISO strings for the API (startDate and endDate are Date objects from the form)
            startDate: newTrip.startDate.toISOString(),
            endDate: newTrip.endDate.toISOString(),
            // Include coordinates if provided
            lat: newTrip.lat ?? null,
            lng: newTrip.lng ?? null,
          });

          statusCode = response.status;

          // Handle 402 paywall - show upsell modal instead of error toast (no retry)
          if (response.status === 402) {
            const errorData = await response.json();
            if (errorData.code === "PAYWALL") {
              // Throw a special error that we'll catch in onError to show modal
              throw new Error("PAYWALL");
            }
            // If it's 402 but not PAYWALL, treat as generic error
            throw new Error(errorData.message || errorData.error || "Failed to create trip");
          }

          // Handle 4xx client errors (validation, bad request, etc.) - no retry
          if (response.status >= 400 && response.status < 500) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || "Failed to create trip");
          }

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || errorData.error || "Failed to create trip");
          }

          // Success! Return the created trip
          return response.json();
        } catch (error: any) {
          lastError = error;
          
          // Don't retry on client errors (4xx) or paywall errors
          if (error.message === "PAYWALL" || (statusCode && statusCode >= 400 && statusCode < 500)) {
            throw error;
          }
          
          // Network/server error (5xx or no response) - retry if we have attempts remaining
          if (attempt < maxRetries) {
            // Show friendly toast on retry
            if (attempt === 1) {
              toast({
                title: "Server is waking up...",
                description: "Retrying connection, please wait.",
              });
            }
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            continue;
          }
          
          // All retries exhausted
          throw new Error(error.message || "Unable to connect to server. Please try again.");
        }
      }
      
      // This should never happen, but TypeScript needs it
      throw lastError || new Error("Failed to create trip");
    },
    onSuccess: () => {
      // Invalidate and refetch trips and entitlements after creating a new one
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entitlements"] });
      form.reset();
      toast({
        title: "Trip created!",
        description: "Your camping trip has been successfully planned.",
      });
    },
    onError: (error: Error) => {
      // Check if this is a paywall error - show modal instead of toast
      if (error.message === "PAYWALL") {
        setShowUpsellModal(true);
        return;
      }
      
      // Show toast for all other errors
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTrip = (data: InsertTrip) => {
    createTripMutation.mutate(data);
  };

  const handleAIGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Coming Soon!",
      description: "AI-powered trip planning will be available soon. Stay tuned!",
    });
  };

  if (isLoading || entitlementsLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading trips...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12 space-y-10">
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

                  {/* Location with Autocomplete */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <LocationAutocomplete
                            value={field.value}
                            onChange={(location, lat, lng) => {
                              field.onChange(location);
                              form.setValue('lat', lat);
                              form.setValue('lng', lng);
                            }}
                            label="Location"
                            placeholder="e.g., Goldstream Provincial Park"
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

                {/* Trip Limit Upsell Banner (only for free users who have hit the limit) */}
                {entitlements && !entitlements.canCreateTrip && !entitlements.isPro && (
                  <Alert className="border-primary/50 bg-primary/5" data-testid="alert-trip-limit">
                    <SparklesIcon className="h-5 w-5 text-primary" />
                    <AlertTitle className="text-base font-semibold">You've reached your free trip limit</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        You've created {entitlements.tripsCount} of {entitlements.limit} free trips. 
                        Upgrade to Pro for unlimited trips and exclusive features!
                      </p>
                      <div className="flex items-center gap-3">
                        <SubscribeButton 
                          label="Upgrade to Pro - $29.99/year" 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        />
                        <span className="text-xs text-muted-foreground">
                          7-day free trial included
                        </span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full md:w-auto"
                  disabled={createTripMutation.isPending || (entitlements && !entitlements.canCreateTrip)}
                  data-testid="button-create-trip"
                >
                  {createTripMutation.isPending 
                    ? "Creating..." 
                    : entitlements && !entitlements.canCreateTrip 
                      ? "Upgrade to Create More Trips" 
                      : "Create Trip"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* AI Trip Planner - Coming Soon */}
        <Card className="max-w-4xl mx-auto opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Describe your trip and we'll build it for you
            </CardTitle>
            <CardDescription>
              Tell us what you're looking for and our AI will help plan your perfect camping adventure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAIGenerate} className="space-y-4">
              <Textarea
                placeholder="e.g., I have March 12–21 free, want to camp near San Diego with my family of 4..."
                rows={4}
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                data-testid="textarea-ai-trip-description"
              />
              <Button 
                type="submit" 
                disabled 
                className="w-full md:w-auto"
                data-testid="button-ai-generate-trip"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                Generate Trip (Coming Soon)
              </Button>
            </form>
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

      {/* Trip Limit Upsell Modal */}
      <TripLimitUpsellModal 
        open={showUpsellModal} 
        onOpenChange={setShowUpsellModal} 
      />
    </div>
  );
}
