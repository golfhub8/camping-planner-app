import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, MapPin, CloudSun, UtensilsCrossed, ShoppingCart, Loader2, Plus, X } from "lucide-react";
import Header from "@/components/Header";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Trip, Recipe } from "@shared/schema";
import { useState } from "react";

// Weather forecast type
type WeatherForecast = {
  location: string;
  forecast: Array<{
    date: string;
    conditions: string;
    high: number;
    low: number;
  }>;
};

// Trip Planner page - shows trip details, weather forecast, meals, and groceries
export default function TripPlanner() {
  const [, params] = useRoute("/trips/:id");
  const tripId = params?.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false);

  // Fetch trip details
  const { data: trip, isLoading: tripLoading } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    enabled: !!tripId,
  });

  // Fetch weather forecast
  const { data: weather, isLoading: weatherLoading } = useQuery<WeatherForecast>({
    queryKey: ["/api/trips", tripId, "weather"],
    enabled: !!tripId,
  });

  // Fetch all user recipes for meal selection
  const { data: allRecipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  // Fetch trip meals (recipes attached to this trip)
  const tripMealIds = trip?.meals || [];
  const tripMeals = allRecipes?.filter(recipe => tripMealIds.includes(recipe.id)) || [];

  // Add meal to trip mutation
  const addMealMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/meals`, { recipeId });
      const data = await response.json();
      return data as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      setAddMealDialogOpen(false);
      toast({
        title: "Meal added!",
        description: "Recipe has been added to your trip.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add meal",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove meal from trip mutation
  const removeMealMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const response = await apiRequest("DELETE", `/api/trips/${tripId}/meals/${recipeId}`);
      const data = await response.json();
      return data as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      toast({
        title: "Meal removed",
        description: "Recipe has been removed from your trip.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove meal",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Format date for display
  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Format full date range
  function formatDateRange(start: Date | string, end: Date | string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  if (!tripId) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Invalid Trip</h2>
            <p className="text-muted-foreground mb-6">
              The trip ID is invalid or missing.
            </p>
            <Button asChild data-testid="button-back-to-trips">
              <Link href="/trips">Back to Trips</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (tripLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Trip Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This trip doesn't exist or you don't have access to it.
            </p>
            <Button asChild data-testid="button-back-to-trips">
              <Link href="/trips">Back to Trips</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Filter out recipes already added to the trip
  const availableRecipes = allRecipes?.filter(recipe => !tripMealIds.includes(recipe.id)) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-5xl">
        {/* Trip Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2" data-testid="trip-title">{trip.name}</h1>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span data-testid="trip-location">{trip.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span data-testid="trip-dates">{formatDateRange(trip.startDate, trip.endDate)}</span>
                </div>
              </div>
            </div>
            <Button variant="outline" asChild data-testid="button-back-to-trips">
              <Link href="/trips">Back to Trips</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Weather Section */}
          <Card data-testid="card-weather">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <span>Weather during your trip</span>
              </CardTitle>
              <CardDescription>
                {weatherLoading ? "Loading forecast..." : `Forecast for ${weather?.location || trip.location}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weatherLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : weather && weather.forecast.length > 0 ? (
                <div className="space-y-2">
                  {weather.forecast.map((day, index) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`weather-day-${index}`}
                    >
                      <span className="w-28 font-medium">{formatDate(day.date)}</span>
                      <span className="flex-1 text-muted-foreground">{day.conditions}</span>
                      <span className="font-semibold">
                        {day.high}° / {day.low}°C
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  Weather forecast unavailable
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Note: This is mock weather data. Configure WEATHER_API_KEY environment variable for real forecasts.
              </p>
            </CardContent>
          </Card>

          {/* Meals Section */}
          <Card data-testid="card-meals">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <span>Planned Meals</span>
                    <Badge variant="outline">{tripMeals.length} recipes</Badge>
                  </CardTitle>
                  <CardDescription>
                    Recipes attached to this trip
                  </CardDescription>
                </div>
                <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-meal">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Meal
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-add-meal">
                    <DialogHeader>
                      <DialogTitle>Add Meal to Trip</DialogTitle>
                      <DialogDescription>
                        Select a recipe to add to your trip's meal plan
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availableRecipes.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          {allRecipes && allRecipes.length > 0
                            ? "All your recipes have been added to this trip."
                            : "You don't have any recipes yet. Create some recipes first!"}
                        </p>
                      ) : (
                        availableRecipes.map((recipe) => (
                          <div
                            key={recipe.id}
                            className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                            data-testid={`recipe-option-${recipe.id}`}
                          >
                            <div>
                              <div className="font-medium">{recipe.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {recipe.ingredients.length} ingredients
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addMealMutation.mutate(recipe.id)}
                              disabled={addMealMutation.isPending}
                              data-testid={`button-add-recipe-${recipe.id}`}
                            >
                              Add
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {tripMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No meals added yet. Click "Add Meal" to attach recipes to this trip.
                </p>
              ) : (
                <div className="space-y-2">
                  {tripMeals.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between p-3 rounded-md border"
                      data-testid={`trip-meal-${recipe.id}`}
                    >
                      <div>
                        <div className="font-medium">{recipe.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {recipe.ingredients.length} ingredients
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMealMutation.mutate(recipe.id)}
                        disabled={removeMealMutation.isPending}
                        data-testid={`button-remove-meal-${recipe.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Groceries Section */}
          <Card data-testid="card-groceries">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span>Groceries & Packing</span>
              </CardTitle>
              <CardDescription>
                Generate shopping list from your trip's meals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {tripMeals.length > 0
                  ? "Generate a combined grocery list from all meals in this trip, plus camping basics."
                  : "Add some meals to this trip first, then generate a grocery list."}
              </p>
              {tripMeals.length > 0 ? (
                <div className="flex gap-2">
                  <Button asChild data-testid="button-generate-grocery">
                    <Link href={`/grocery/list?tripId=${tripId}`}>
                      Generate Grocery List
                    </Link>
                  </Button>
                  <Button variant="outline" asChild data-testid="button-view-share-link">
                    <Link href={`/trips/${tripId}/details`}>
                      View Share Link
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button disabled data-testid="button-generate-grocery-disabled">
                  Generate Grocery List
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
