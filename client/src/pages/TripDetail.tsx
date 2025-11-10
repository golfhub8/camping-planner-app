import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addCollaboratorSchema, addTripCostSchema, addMealSchema, type Trip, type Recipe, type GroceryItem, type GroceryCategory } from "@shared/schema";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, UtensilsIcon, ArrowLeftIcon, PlusIcon, XIcon, ShoppingCartIcon, CopyIcon, CheckIcon, Share2Icon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { z } from "zod";

export default function TripDetail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/trips/:id");
  const tripId = params?.id ? parseInt(params.id) : null;
  
  // State for dialogs
  const [addMealDialogOpen, setAddMealDialogOpen] = useState(false);
  const [groceryDialogOpen, setGroceryDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

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

  // Mutation to add meal to trip
  const addMealMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/meals`, { recipeId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      setAddMealDialogOpen(false);
      toast({
        title: "Meal added!",
        description: "Recipe has been added to your trip.",
      });
    },
  });

  // Mutation to remove meal from trip
  const removeMealMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      const response = await apiRequest("DELETE", `/api/trips/${tripId}/meals/${recipeId}`);
      return response.json();
    },
    onSuccess: () => {
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

  // Get recipes that aren't already added to the trip
  const availableRecipes = recipes.filter(
    recipe => !trip.meals?.includes(recipe.id)
  );

  // Handle opening grocery dialog
  const handleOpenGroceryDialog = async () => {
    setGroceryDialogOpen(true);
    if (trip.meals && trip.meals.length > 0) {
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
                      disabled={availableRecipes.length === 0}
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
                        Select a recipe to add to your trip
                      </DialogDescription>
                    </DialogHeader>
                    
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
                  </DialogContent>
                </Dialog>
              </div>
            </div>
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
                    <div className="flex items-center gap-2">
                      <UtensilsIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{meal.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMealMutation.mutate(meal.id)}
                      disabled={removeMealMutation.isPending}
                      data-testid={`button-remove-meal-${idx}`}
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
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
      </main>
    </div>
  );
}
