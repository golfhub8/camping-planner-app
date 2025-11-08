import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addCollaboratorSchema, addTripCostSchema, type Trip, type Recipe } from "@shared/schema";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, UtensilsIcon, ArrowLeftIcon } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

export default function TripDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/trips/:id");
  const tripId = params?.id ? parseInt(params.id) : null;

  // Fetch trip data
  const { data: trip, isLoading: tripLoading, error: tripError } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error("Trip not found");
      }
      return response.json();
    },
    enabled: tripId !== null,
  });

  // Fetch all recipes to map meal IDs to titles
  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  // Form for adding a collaborator
  const collaboratorForm = useForm({
    resolver: zodResolver(addCollaboratorSchema),
    defaultValues: {
      collaborator: "",
    },
  });

  // Form for updating cost
  const costForm = useForm({
    resolver: zodResolver(addTripCostSchema),
    defaultValues: {
      total: 0,
      paidBy: "",
    },
  });

  // Mutation to add collaborator
  const addCollaboratorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addCollaboratorSchema>) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/collaborators`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      collaboratorForm.reset();
    },
  });

  // Mutation to update cost
  const updateCostMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTripCostSchema>) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/cost`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
    },
  });

  if (!match || tripId === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-destructive">Invalid trip ID</div>
        </main>
      </div>
    );
  }

  if (tripLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading trip details...</div>
        </main>
      </div>
    );
  }

  if (tripError || !trip) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-destructive">
            {tripError ? "Error loading trip" : "Trip not found"}
          </div>
        </main>
      </div>
    );
  }

  // Calculate cost per person
  const peopleCount = (trip.collaborators?.length || 0) + 1; // +1 for trip owner
  const totalCost = trip.costTotal ? parseFloat(trip.costTotal) : 0;
  const costPerPerson = totalCost / peopleCount;

  // Get meal titles from recipe IDs
  const meals = trip.meals?.map(mealId => {
    const recipe = recipes.find(r => r.id === mealId);
    return recipe ? { id: mealId, title: recipe.title } : { id: mealId, title: `Recipe #${mealId}` };
  }) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12 space-y-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate("/trips")}
          data-testid="button-back-to-trips"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Trips
        </Button>

        {/* Trip Header */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-foreground" data-testid="text-trip-name">
            {trip.name}
          </h1>
          {trip.location && (
            <div className="flex items-center gap-2 text-xl text-muted-foreground">
              <MapPinIcon className="w-5 h-5" />
              <span data-testid="text-trip-location">{trip.location}</span>
            </div>
          )}
          {trip.startDate && trip.endDate && (
            <div className="flex items-center gap-2 text-lg text-muted-foreground">
              <CalendarIcon className="w-5 h-5" />
              <span data-testid="text-trip-dates">
                {format(new Date(trip.startDate), 'MMMM d, yyyy')} - {format(new Date(trip.endDate), 'MMMM d, yyyy')}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Collaborators Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="w-5 h-5" />
                Collaborators
              </CardTitle>
              <CardDescription>
                {peopleCount} {peopleCount === 1 ? 'person' : 'people'} on this trip
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing Collaborators */}
              {trip.collaborators && trip.collaborators.length > 0 ? (
                <div className="flex flex-wrap gap-2" data-testid="list-collaborators">
                  {trip.collaborators.map((collaborator, idx) => (
                    <Badge key={idx} variant="secondary" data-testid={`badge-collaborator-${idx}`}>
                      {collaborator}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No collaborators yet. Add one below!</p>
              )}

              <Separator />

              {/* Add Collaborator Form */}
              <Form {...collaboratorForm}>
                <form 
                  onSubmit={collaboratorForm.handleSubmit((data) => addCollaboratorMutation.mutate(data))}
                  className="space-y-3"
                >
                  <FormField
                    control={collaboratorForm.control}
                    name="collaborator"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Add Collaborator</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Email or name"
                            data-testid="input-add-collaborator"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit"
                    disabled={addCollaboratorMutation.isPending}
                    data-testid="button-submit-collaborator"
                  >
                    {addCollaboratorMutation.isPending ? "Adding..." : "Add Collaborator"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Cost Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSignIcon className="w-5 h-5" />
                Grocery Cost
              </CardTitle>
              <CardDescription>
                Track and split expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cost Display */}
              {totalCost > 0 ? (
                <div className="space-y-2" data-testid="cost-display">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <span className="text-2xl font-bold" data-testid="text-total-cost">
                      ${totalCost.toFixed(2)}
                    </span>
                  </div>
                  {peopleCount > 1 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">People:</span>
                        <span className="font-medium" data-testid="text-people-count">{peopleCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Each person:</span>
                        <span className="text-lg font-semibold text-primary" data-testid="text-cost-per-person">
                          ${costPerPerson.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {trip.costPaidBy && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-muted-foreground">Paid by:</span>
                      <span className="text-sm" data-testid="text-paid-by">{trip.costPaidBy}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No cost set yet</p>
              )}

              <Separator />

              {/* Update Cost Form */}
              <Form {...costForm}>
                <form 
                  onSubmit={costForm.handleSubmit((data) => updateCostMutation.mutate(data))}
                  className="space-y-3"
                >
                  <FormField
                    control={costForm.control}
                    name="total"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Update Total Cost</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            data-testid="input-cost-total"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={costForm.control}
                    name="paidBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid By (optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Email or name"
                            data-testid="input-cost-paid-by"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit"
                    disabled={updateCostMutation.isPending}
                    data-testid="button-submit-cost"
                  >
                    {updateCostMutation.isPending ? "Updating..." : "Update Cost"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Meals Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsIcon className="w-5 h-5" />
              Meals for this Trip
            </CardTitle>
            <CardDescription>
              {meals.length} {meals.length === 1 ? 'meal' : 'meals'} planned
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meals.length > 0 ? (
              <div className="space-y-2" data-testid="list-meals">
                {meals.map((meal, idx) => (
                  <div 
                    key={meal.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    data-testid={`meal-item-${idx}`}
                  >
                    <span className="font-medium">{meal.title}</span>
                    <Badge variant="outline">Recipe #{meal.id}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No meals planned yet</p>
                <p className="text-sm text-muted-foreground">
                  Add recipes to this trip to plan your meals
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
