import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addCollaboratorSchema, addTripCostSchema, addMealSchema, type Trip, type Recipe, type GroceryItem, type GroceryCategory } from "@shared/schema";
import EditTripDialog from "@/components/EditTripDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, UtensilsIcon, ArrowLeftIcon, PlusIcon, XIcon, ShoppingCartIcon, CopyIcon, CheckIcon, Share2Icon, CloudSunIcon, Loader2, PencilIcon, PackageIcon, ChevronDownIcon, ChevronRightIcon, CloudRain } from "lucide-react";
import SubscribeButton from "@/components/SubscribeButton";
import { CurrentWeather, WeatherForecast } from "@/components/WeatherCard";
import { useWeatherCard } from "@/hooks/useWeatherCard";
import { useToast } from "@/hooks/use-toast";
import NearbyHikes from "@/components/NearbyHikes";
import { format } from "date-fns";
import { z } from "zod";
import { parseIngredient } from "@/lib/ingredients";

// Component to display meal ingredients with checkboxes
interface MealIngredientsProps {
  meal: { 
    id: number; 
    title: string; 
    isExternal: boolean; 
    recipeId?: number; 
    externalRecipeId?: string 
  };
  selectedIngredients: Set<string>;
  onToggleIngredient: (ingredient: string) => void;
  onSelectAll: (ingredients: string[]) => void;
  onAddToGrocery: (recipeTitle: string, allIngredients: string[]) => void;
  onMarkAlreadyHave: (ingredients: string[]) => void;
}

function MealIngredients({
  meal,
  selectedIngredients,
  onToggleIngredient,
  onSelectAll,
  onAddToGrocery,
  onMarkAlreadyHave,
}: MealIngredientsProps) {
  // Fetch ingredients based on meal type (internal vs external)
  const { data: ingredientsData, isLoading } = useQuery<{ ingredients: string[] }>({
    queryKey: meal.isExternal 
      ? ["/api/recipes/external", meal.externalRecipeId, "ingredients"]
      : ["/api/recipes", meal.recipeId],
    queryFn: async () => {
      if (meal.isExternal) {
        // Fetch external recipe ingredients
        const response = await fetch(`/api/recipes/external/${meal.externalRecipeId}/ingredients`);
        if (!response.ok) throw new Error("Failed to fetch external recipe ingredients");
        return response.json();
      } else {
        // Fetch internal recipe (includes ingredients array)
        const response = await fetch(`/api/recipes/${meal.recipeId}`);
        if (!response.ok) throw new Error("Failed to fetch recipe");
        return response.json();
      }
    },
    enabled: !!(meal.recipeId || meal.externalRecipeId), // Only fetch if we have an ID
  });

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ingredients = ingredientsData?.ingredients || [];

  if (ingredients.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No ingredients found for this meal
      </div>
    );
  }

  const allSelected = ingredients.length > 0 && ingredients.every(ing => selectedIngredients.has(ing));

  return (
    <div className="p-4 space-y-4 border-t">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectAll(allSelected ? [] : ingredients)}
          data-testid="button-meal-select-all"
        >
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => onAddToGrocery(meal.title, ingredients)}
          data-testid="button-meal-add-to-grocery"
        >
          <ShoppingCartIcon className="w-4 h-4 mr-2" />
          Add Selected to Grocery
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onMarkAlreadyHave(ingredients)}
          data-testid="button-meal-mark-already-have"
        >
          Mark Others as Already Have
        </Button>
      </div>

      {/* Ingredients List with Checkboxes */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Ingredients ({ingredients.length})
        </p>
        <div className="space-y-1">
          {ingredients.map((ingredient, idx) => {
            const isChecked = selectedIngredients.has(ingredient);
            return (
              <div
                key={idx}
                className="flex items-center gap-2"
                data-testid={`meal-ingredient-${idx}`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleIngredient(ingredient)}
                  data-testid={`checkbox-meal-ingredient-${idx}`}
                />
                <label
                  className="text-sm cursor-pointer flex-1"
                  onClick={() => onToggleIngredient(ingredient)}
                >
                  {ingredient}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TripDetail() {
  const { toast} = useToast();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/trips/:id");
  const tripId = params?.id ? parseInt(params.id) : null;
  
  // State for dialogs
  const [editTripDialogOpen, setEditTripDialogOpen] = useState(false);
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false);
  const [groceryDialogOpen, setGroceryDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  
  // State for expanded meals and selected ingredients
  const [expandedMeals, setExpandedMeals] = useState<Set<number>>(new Set());
  const [selectedIngredients, setSelectedIngredients] = useState<Map<number, Set<string>>>(new Map());

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

  // Fetch trip meals from the trip_meals table
  const { data: tripMeals = [], isLoading: mealsLoading } = useQuery<any[]>({
    queryKey: ["/api/trips", tripId, "meals"],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/meals`);
      if (!response.ok) {
        throw new Error("Failed to fetch meals");
      }
      return response.json();
    },
    enabled: tripId !== null,
  });

  // Fetch all recipes to map meal IDs to titles
  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  // Weather data - hook must be called unconditionally at top level
  const lat = trip?.lat ? parseFloat(trip.lat) : null;
  const lng = trip?.lng ? parseFloat(trip.lng) : null;
  const { weather, isLoading: weatherLoading, error: weatherError, tempUnit, toggleTempUnit, formatTemp } = useWeatherCard(lat, lng, 7);

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
      total: "" as any, // Start empty so user can type freely
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

  // Mutation to add meal to trip
  const addMealMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/meals`, { recipeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      setAddMealDialogOpen(false);
      toast({
        title: "Meal added!",
        description: "Recipe has been added to your trip.",
      });
    },
  });

  // Mutation to remove meal from trip (mealId is the trip_meals.id, not recipeId)
  const removeMealMutation = useMutation({
    mutationFn: async (mealId: number) => {
      const response = await apiRequest("DELETE", `/api/trips/${tripId}/meals/${mealId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      toast({
        title: "Meal removed",
        description: "Recipe has been removed from your trip.",
      });
    },
  });

  // Query to fetch grocery list for the trip
  const { data: groceryData, refetch: refetchGrocery } = useQuery<{
    items: GroceryItem[];
    grouped: Record<GroceryCategory, GroceryItem[]>;
  }>({
    queryKey: ["/api/trips", tripId, "grocery"],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/grocery`);
      if (!response.ok) {
        throw new Error("Failed to fetch grocery list");
      }
      return response.json();
    },
    enabled: false, // Only fetch when dialog is opened
  });

  // Query to fetch existing share link for trip
  const { data: existingShare, refetch: refetchShare } = useQuery<{
    token: string;
    shareUrl: string;
    tripName: string;
    itemCount: number;
  } | null>({
    queryKey: ["/api/trips", tripId, "share"],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/share`);
      if (response.status === 404) {
        return null; // No existing share
      }
      if (!response.ok) {
        throw new Error("Failed to fetch share link");
      }
      return response.json();
    },
    enabled: false, // Only fetch when needed
  });

  // Mutation to create/update share link for trip
  const createShareLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/share`, {});
      return response.json();
    },
    onSuccess: (data: { shareUrl: string; token: string; tripName: string; itemCount: number }) => {
      setShareUrl(data.shareUrl);
      setShareDialogOpen(true);
      toast({
        title: "Share link created!",
        description: `Trip grocery list with ${data.itemCount} items is ready to share.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create share link",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle share button click - fetch existing or create new
  const handleShareClick = async () => {
    // First check if there's an existing share
    const result = await refetchShare();
    if (result.data) {
      // Use existing share
      setShareUrl(result.data.shareUrl);
      setShareDialogOpen(true);
    } else {
      // Create new share
      createShareLinkMutation.mutate();
    }
  };

  if (!match || tripId === null) {
    return (
      <main className="container mx-auto px-6 md:px-10 py-12">
        <div className="text-center text-destructive">Invalid trip ID</div>
      </main>
    );
  }

  if (tripLoading || mealsLoading) {
    return (
      <main className="container mx-auto px-6 md:px-10 py-12">
        <div className="text-center text-muted-foreground">Loading trip details...</div>
      </main>
    );
  }

  if (tripError || !trip) {
    return (
      <main className="container mx-auto px-6 md:px-10 py-12">
        <div className="text-center text-destructive">
          {tripError ? "Error loading trip" : "Trip not found"}
        </div>
      </main>
    );
  }

  // Calculate cost per person
  const peopleCount = (trip.collaborators?.length || 0) + 1; // +1 for trip owner
  const totalCost = trip.costTotal ? parseFloat(trip.costTotal) : 0;
  const costPerPerson = totalCost / peopleCount;

  // Get meal titles from trip_meals (supports both internal and external recipes)
  const meals = tripMeals.map(meal => {
    if (meal.isExternal) {
      // External recipe from WordPress
      return { 
        id: meal.id, 
        title: meal.title,
        isExternal: true,
        externalRecipeId: meal.externalRecipeId,
      };
    } else {
      // Internal recipe from database
      const recipe = recipes.find(r => r.id === meal.recipeId);
      return { 
        id: meal.id, 
        title: recipe?.title || `Recipe #${meal.recipeId}`,
        isExternal: false,
        recipeId: meal.recipeId,
      };
    }
  });

  // Get recipes that aren't already added to the trip (only check internal recipes)
  const addedInternalRecipeIds = tripMeals
    .filter(m => !m.isExternal && m.recipeId)
    .map(m => m.recipeId);
  const availableRecipes = recipes.filter(
    recipe => !addedInternalRecipeIds.includes(recipe.id)
  );

  // Handle opening grocery dialog
  const handleOpenGroceryDialog = async () => {
    setGroceryDialogOpen(true);
    if (tripMeals && tripMeals.length > 0) {
      await refetchGrocery();
    }
  };

  // Copy grocery list to clipboard
  const handleCopyGroceryList = async () => {
    if (!groceryData || !groceryData.items || groceryData.items.length === 0) {
      return;
    }

    // Generate plain text for copying
    let text = `${trip.name} - Shopping List\n\n`;
    
    const categories: GroceryCategory[] = ["Produce", "Dairy", "Meat", "Pantry", "Camping Gear"];
    categories.forEach(category => {
      const items = groceryData.grouped[category];
      if (items && items.length > 0) {
        text += `${category}:\n`;
        items.forEach(item => {
          text += `- ${item.name}\n`;
        });
        text += "\n";
      }
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied to clipboard!",
        description: "You can now paste this list into a text message or email.",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying the text manually.",
        variant: "destructive",
      });
    }
  };

  // Copy share URL to clipboard
  const handleCopyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast({
        title: "Link copied!",
        description: "You can now paste and share the link with collaborators.",
      });
      setTimeout(() => setShareCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="container mx-auto px-6 md:px-10 py-12 space-y-8">
        {/* Back Button and Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/trips")}
            data-testid="button-back-to-trips"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Trips
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditTripDialogOpen(true)}
            data-testid="button-edit-trip-detail"
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Edit Trip
          </Button>
        </div>

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

        {/* Weather & Hikes Section */}
        {!lat || !lng ? (
          <Card data-testid="card-weather-hint">
            <CardContent className="py-4 flex items-start gap-3">
              <CloudSunIcon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong>Add coordinates for weather forecasts:</strong> Edit your trip and use the location autocomplete to select a place with coordinates.
              </p>
            </CardContent>
          </Card>
        ) : weatherLoading ? (
          <Card data-testid="card-weather-loading">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-primary" />
                Weather Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : weatherError || !weather ? (
          <Card data-testid="card-weather-error">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-primary" />
                Weather Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Unable to load weather forecast
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Current weather - full width */}
            <CurrentWeather 
              weather={weather} 
              tempUnit={tempUnit} 
              toggleTempUnit={toggleTempUnit} 
              formatTemp={formatTemp} 
            />
            
            {/* Forecast and Hikes - side by side on desktop */}
            <div className="grid gap-4 lg:grid-cols-2">
              <WeatherForecast 
                weather={weather} 
                formatTemp={formatTemp} 
                tripStartDate={trip.startDate}
                tripEndDate={trip.endDate}
              />
              
              {/* Nearby Hikes from NPS API */}
              <NearbyHikes tripId={trip.id} location={trip.location} />
            </div>
          </div>
        )}

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
                            value={field.value}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => field.onChange(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsIcon className="w-5 h-5" />
                  Meals for this Trip
                </CardTitle>
                <CardDescription>
                  {meals.length} {meals.length === 1 ? 'meal' : 'meals'} planned
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {/* Share Grocery List Button */}
                <Button
                  variant="default"
                  size="sm"
                  disabled={meals.length === 0 || createShareLinkMutation.isPending}
                  onClick={handleShareClick}
                  data-testid="button-share-trip-grocery"
                >
                  <Share2Icon className="w-4 h-4 mr-2" />
                  Share Grocery List
                </Button>

                {/* Generate Grocery List Button */}
                <Dialog open={groceryDialogOpen} onOpenChange={setGroceryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meals.length === 0}
                      onClick={handleOpenGroceryDialog}
                      data-testid="button-generate-grocery"
                    >
                      <ShoppingCartIcon className="w-4 h-4 mr-2" />
                      Grocery List
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Shopping List for {trip.name}</DialogTitle>
                      <DialogDescription>
                        Combined ingredients from all {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
                      </DialogDescription>
                    </DialogHeader>
                    
                    {groceryData && groceryData.items.length > 0 ? (
                      <div className="space-y-4">
                        {/* Copy Button */}
                        <Button
                          onClick={handleCopyGroceryList}
                          variant="outline"
                          className="w-full"
                          data-testid="button-copy-grocery"
                        >
                          {copied ? (
                            <>
                              <CheckIcon className="w-4 h-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <CopyIcon className="w-4 h-4 mr-2" />
                              Copy to Clipboard
                            </>
                          )}
                        </Button>

                        {/* Grocery Items by Category */}
                        <div className="space-y-4">
                          {(["Produce", "Dairy", "Meat", "Pantry", "Camping Gear"] as GroceryCategory[]).map(category => {
                            const items = groceryData.grouped[category];
                            if (!items || items.length === 0) return null;
                            
                            return (
                              <div key={category} className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">{category}</h3>
                                <ul className="space-y-1">
                                  {items.map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm">
                                      <span className="text-primary">•</span>
                                      <span>{item.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No ingredients to display
                      </p>
                    )}
                  </DialogContent>
                </Dialog>

                {/* Add Meal Dialog */}
                <Dialog open={addMealDialogOpen} onOpenChange={setAddMealDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      data-testid="button-add-meal"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Meal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a Meal</DialogTitle>
                      <DialogDescription>
                        {availableRecipes.length === 0 
                          ? "Create some recipes first to add meals to your trip"
                          : "Select a recipe to add to your trip"
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    {availableRecipes.length === 0 ? (
                      <div className="text-center py-8 space-y-4">
                        <p className="text-muted-foreground">
                          You haven't created any recipes yet, or all your recipes are already added to this trip.
                        </p>
                        <Button
                          onClick={() => {
                            setAddMealDialogOpen(false);
                            navigate(`/recipes?createNew=true&addToTrip=${params.id}`);
                          }}
                          data-testid="button-create-recipe"
                        >
                          Create a Recipe
                        </Button>
                      </div>
                    ) : (
                      <Command>
                        <CommandInput placeholder="Search recipes..." data-testid="input-search-recipes" />
                        <CommandList>
                          <CommandEmpty>No recipes found.</CommandEmpty>
                          <CommandGroup>
                            {availableRecipes.map((recipe) => (
                              <CommandItem
                                key={recipe.id}
                                onSelect={() => addMealMutation.mutate(recipe.id)}
                                data-testid={`recipe-option-${recipe.id}`}
                              >
                                <UtensilsIcon className="w-4 h-4 mr-2" />
                                {recipe.title}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {meals.length > 0 ? (
              <div className="space-y-2" data-testid="list-meals">
                {meals.map((meal, idx) => {
                  const isExpanded = expandedMeals.has(meal.id);
                  const selectedIngs = selectedIngredients.get(meal.id) || new Set();
                  
                  // Handler to toggle expansion
                  const toggleExpanded = () => {
                    setExpandedMeals(prev => {
                      const next = new Set(prev);
                      if (next.has(meal.id)) {
                        next.delete(meal.id);
                      } else {
                        next.add(meal.id);
                      }
                      return next;
                    });
                  };
                  
                  // Handler to toggle individual ingredient checkbox
                  const toggleIngredient = (ingredient: string) => {
                    setSelectedIngredients(prev => {
                      const next = new Map(prev);
                      const mealIngs = new Set(next.get(meal.id) || []);
                      if (mealIngs.has(ingredient)) {
                        mealIngs.delete(ingredient);
                      } else {
                        mealIngs.add(ingredient);
                      }
                      next.set(meal.id, mealIngs);
                      return next;
                    });
                  };
                  
                  // Handler to select all ingredients
                  const selectAllIngredients = (ingredients: string[]) => {
                    setSelectedIngredients(prev => {
                      const next = new Map(prev);
                      next.set(meal.id, new Set(ingredients));
                      return next;
                    });
                  };
                  
                  // Handler to add selected ingredients to grocery  
                  const addSelectedToGrocery = (recipeTitle: string, allIngredients: string[]) => {
                    const selected = Array.from(selectedIngs);
                    if (selected.length === 0) {
                      toast({
                        title: "No ingredients selected",
                        description: "Please select at least one ingredient to add to your grocery list.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Compute "already have" normalized keys for unchecked ingredients
                    const uncheckedIngredients = allIngredients.filter(ing => !selectedIngs.has(ing));
                    const alreadyHaveNormalized = uncheckedIngredients.map(ing => parseIngredient(ing).normalized);
                    
                    // Store extended payload in sessionStorage for GrocerySelection handoff
                    // Extended payload includes ALL ingredients + selected subset + already-have metadata
                    const groceryData = {
                      recipeId: meal.recipeId || null,
                      externalRecipeId: meal.externalRecipeId || null,
                      recipeTitle,
                      allIngredients,  // ALL ingredients (needed + pantry)
                      selectedIngredients: selected,  // ONLY checked ingredients
                      alreadyHaveNormalized,  // Normalized keys for unchecked ingredients
                    };
                    sessionStorage.setItem('pendingGroceryItems', JSON.stringify(groceryData));
                    
                    toast({
                      title: "Added to grocery selection!",
                      description: `${selected.length} ${selected.length === 1 ? 'ingredient' : 'ingredients'} from ${recipeTitle}`,
                    });
                    
                    // Navigate to grocery page
                    navigate("/grocery");
                  };
                  
                  // Handler to mark unchecked ingredients as already have
                  const markOthersAsAlreadyHave = (ingredients: string[]) => {
                    const uncheckedIngredients = ingredients.filter(ing => !selectedIngs.has(ing));
                    
                    if (uncheckedIngredients.length === 0) {
                      toast({
                        title: "All ingredients are selected",
                        description: "Uncheck some ingredients first to mark them as already owned.",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Store unchecked ingredients using normalized keys (parseIngredient strips amounts/units)
                    const alreadyHaveData = {
                      normalizedKeys: uncheckedIngredients.map(ing => parseIngredient(ing).normalized)
                    };
                    sessionStorage.setItem('alreadyHaveIngredients', JSON.stringify(alreadyHaveData));
                    
                    toast({
                      title: "Marked as already owned!",
                      description: `${uncheckedIngredients.length} ${uncheckedIngredients.length === 1 ? 'ingredient' : 'ingredients'} marked as pantry items`,
                    });
                  };
                  
                  return (
                    <Collapsible
                      key={meal.id}
                      open={isExpanded}
                      onOpenChange={toggleExpanded}
                      className="border rounded-lg"
                    >
                      <div className="flex items-center justify-between p-3" data-testid={`meal-item-${idx}`}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="flex-1 justify-start gap-2 hover-elevate"
                            data-testid={`button-toggle-meal-${idx}`}
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                            )}
                            <UtensilsIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{meal.title}</span>
                            {meal.isExternal && (
                              <Badge variant="secondary" className="ml-2">External</Badge>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMealMutation.mutate(meal.id);
                          }}
                          disabled={removeMealMutation.isPending}
                          data-testid={`button-remove-meal-${idx}`}
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <CollapsibleContent>
                        <MealIngredients
                          meal={meal}
                          selectedIngredients={selectedIngs}
                          onToggleIngredient={toggleIngredient}
                          onSelectAll={selectAllIngredients}
                          onAddToGrocery={addSelectedToGrocery}
                          onMarkAlreadyHave={markOthersAsAlreadyHave}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
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

        {/* What to Pack Teaser */}
        <Card data-testid="card-what-to-pack">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackageIcon className="w-5 h-5" />
                  What to Pack
                </CardTitle>
                <CardDescription>
                  Essential camping gear for your trip
                </CardDescription>
              </div>
              <SubscribeButton label="Unlock Full List" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Teaser items (5-6 items) */}
            <div className="space-y-2">
              {[
                "Tent and stakes",
                "Sleeping bags",
                "First aid kit",
                "Flashlight or headlamp",
                "Water bottles",
                "Camp stove and fuel"
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`pack-item-${idx}`}
                >
                  <span className="text-primary">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Get access to the complete camping packing checklist with Pro Membership ($29.99/year with 7-day free trial)
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>• Comprehensive packing lists for all seasons</li>
                <li>• Printable camping planners and activity sheets</li>
                <li>• Meal planning templates</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Share Grocery List Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent data-testid="dialog-share-trip-grocery">
            <DialogHeader>
              <DialogTitle>Share Trip Grocery List</DialogTitle>
              <DialogDescription>
                Share this link with your trip collaborators so they can view the grocery list.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
                  data-testid="input-share-trip-url"
                />
                <Button
                  onClick={handleCopyShareUrl}
                  variant="outline"
                  size="icon"
                  data-testid="button-copy-trip-url"
                >
                  {shareCopied ? (
                    <CheckIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Anyone with this link can view the grocery list for {trip.name}. Perfect for sharing with family members or other trip collaborators!
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Trip Dialog */}
        {trip && (
          <EditTripDialog
            trip={trip}
            open={editTripDialogOpen}
            onOpenChange={setEditTripDialogOpen}
          />
        )}
      </main>
  );
}
