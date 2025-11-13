import { useState, useEffect } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Loader2, ExternalLink, ArrowLeft, AlertCircle } from "lucide-react";
import type { Recipe, Trip, GroceryItem } from "@shared/schema";
import { mergeIngredients, normalizeIngredientKey, type MergedIngredient } from "@/lib/ingredients";
import { categorizeIngredient } from "@/lib/categorize";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";

enum Step {
  SELECTION = "selection",
  CONFIRMATION = "confirmation",
}

interface ConfirmedIngredient extends MergedIngredient {
  isNeeded: boolean; // true = add to grocery list, false = already have it
}

export default function GrocerySelection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>(Step.SELECTION);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [manuallySelectedRecipeIds, setManuallySelectedRecipeIds] = useState<Set<number>>(new Set());
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [selectedTripMealIds, setSelectedTripMealIds] = useState<number[]>([]);
  const [externalMealsTitles, setExternalMealsTitles] = useState<string[]>([]);
  const [tripMealRecipeIds, setTripMealRecipeIds] = useState<Map<number, number>>(new Map());
  
  // Confirmation step state
  const [confirmedIngredients, setConfirmedIngredients] = useState<ConfirmedIngredient[]>([]);
  const [moveUncheckedToPantry, setMoveUncheckedToPantry] = useState(false);
  
  // Discriminated union for ingredients from RecipeDetail or TripDetail
  type RecipeDetailPayload = 
    | { kind: "minimal"; recipeId: number; recipeTitle: string; ingredients: string[] }
    | { kind: "extended"; recipeId: number; recipeTitle: string; allIngredients: string[]; selectedIngredients: string[]; alreadyHaveNormalized: string[] };
  
  const [recipeDetailIngredients, setRecipeDetailIngredients] = useState<RecipeDetailPayload | null>(null);

  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    refetchOnMount: true,
  });

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  const { data: tripMeals = [] } = useQuery<any[]>({
    queryKey: ["/api/trips", selectedTripId, "meals"],
    enabled: !!selectedTripId,
  });

  // Prefetch ingredients for selected external trip meals
  // This keeps `proceedToConfirmation` synchronous and provides loading feedback
  const selectedExternalMeals = selectedTripMealIds
    .map(id => tripMeals.find(m => m.id === id))
    .filter(meal => meal?.isExternal && meal?.externalRecipeId);
  
  const externalIngredientsQueries = useQueries({
    queries: selectedExternalMeals.map((meal) => ({
      queryKey: ["/api/recipes/external", meal.externalRecipeId, "ingredients"],
      queryFn: async () => {
        const response = await fetch(`/api/recipes/external/${meal.externalRecipeId}/ingredients`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ingredients for ${meal.title}`);
        }
        return response.json();
      },
      enabled: !!meal.externalRecipeId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    })),
  });

  // Track loading/error state for external ingredients
  const externalIngredientsLoading = externalIngredientsQueries.some(q => q.isLoading);
  const externalIngredientsError = externalIngredientsQueries.some(q => q.isError);
  const failedExternalMeals = selectedExternalMeals.filter((_, index) => 
    externalIngredientsQueries[index]?.isError
  );
  
  // Retry handler for failed external ingredient queries
  const retryFailedQueries = () => {
    externalIngredientsQueries.forEach((query, index) => {
      if (query.isError) {
        query.refetch();
      }
    });
  };

  // Check for pending grocery items from RecipeDetail on mount
  useEffect(() => {
    const pendingData = sessionStorage.getItem('pendingGroceryItems');
    if (pendingData) {
      try {
        const data = JSON.parse(pendingData);
        
        // Detect extended payload from TripDetail (has allIngredients + selectedIngredients + alreadyHaveNormalized)
        if (data.allIngredients && data.selectedIngredients && data.alreadyHaveNormalized) {
          // Extended payload from TripDetail: preserve ALL ingredients with pantry metadata
          setRecipeDetailIngredients({
            kind: "extended",
            recipeId: data.recipeId,
            recipeTitle: data.recipeTitle,
            allIngredients: data.allIngredients,  // ALL ingredients (needed + pantry)
            selectedIngredients: data.selectedIngredients,  // ONLY checked ingredients
            alreadyHaveNormalized: data.alreadyHaveNormalized,  // Normalized pantry keys
          });
          
          // Auto-select the recipe from TripDetail
          if (data.recipeId && !selectedRecipeIds.includes(data.recipeId)) {
            setSelectedRecipeIds(prev => [...prev, data.recipeId]);
            setManuallySelectedRecipeIds(prev => new Set(prev).add(data.recipeId));
          }
        } else if (data.recipeId !== undefined && Array.isArray(data.ingredients) && data.ingredients.length > 0) {
          // Minimal payload from RecipeDetail/IngredientPicker: use ONLY selected ingredients
          setRecipeDetailIngredients({
            kind: "minimal",
            recipeId: data.recipeId,
            recipeTitle: data.recipeTitle,
            ingredients: data.ingredients
          });
          
          // Auto-select the recipe (recipeId can be 0 for external recipes)
          if (!selectedRecipeIds.includes(data.recipeId)) {
            setSelectedRecipeIds(prev => [...prev, data.recipeId]);
            setManuallySelectedRecipeIds(prev => new Set(prev).add(data.recipeId));
          }
        }
        // DON'T clear pending data here - it will be cleared when user proceeds to confirmation
        // This prevents the empty state from showing on re-render
      } catch (e) {
        console.error('Failed to parse pending grocery items:', e);
        sessionStorage.removeItem('pendingGroceryItems');
      }
    }
  }, []);

  function toggleRecipe(recipeId: number) {
    const isManuallySelected = manuallySelectedRecipeIds.has(recipeId);
    
    if (isManuallySelected) {
      setManuallySelectedRecipeIds(prevManual => {
        const newManual = new Set(prevManual);
        newManual.delete(recipeId);
        return newManual;
      });
      
      const isInTripMeals = Array.from(tripMealRecipeIds.values()).includes(recipeId);
      
      if (!isInTripMeals) {
        setSelectedRecipeIds(prev => prev.filter(id => id !== recipeId));
        
        // Clear recipeDetailIngredients if this was the recipe from RecipeDetail
        if (recipeDetailIngredients && recipeDetailIngredients.recipeId === recipeId) {
          setRecipeDetailIngredients(null);
        }
      }
    } else {
      setManuallySelectedRecipeIds(prevManual => new Set(prevManual).add(recipeId));
      
      setSelectedRecipeIds(prev => {
        if (!prev.includes(recipeId)) {
          return [...prev, recipeId];
        }
        return prev;
      });
    }
  }

  function toggleTripMeal(mealId: number, meal: any) {
    setSelectedTripMealIds((prev) => {
      if (prev.includes(mealId)) {
        if (meal.isExternal && !meal.recipeId) {
          setExternalMealsTitles(prevTitles => prevTitles.filter(t => t !== meal.title));
        } else if (meal.recipeId) {
          setTripMealRecipeIds(prevMap => {
            const newMap = new Map(prevMap);
            newMap.delete(mealId);
            
            const wasManuallySelected = manuallySelectedRecipeIds.has(meal.recipeId);
            const stillInOtherMeals = Array.from(newMap.values()).includes(meal.recipeId);
            
            if (!wasManuallySelected && !stillInOtherMeals) {
              setSelectedRecipeIds(prevIds => prevIds.filter(id => id !== meal.recipeId));
            }
            
            return newMap;
          });
        }
        return prev.filter(id => id !== mealId);
      } else {
        if (meal.isExternal && !meal.recipeId) {
          setExternalMealsTitles(prevTitles => [...prevTitles, meal.title]);
        } else if (meal.recipeId) {
          const wasAlreadySelected = selectedRecipeIds.includes(meal.recipeId);
          
          if (!wasAlreadySelected) {
            setSelectedRecipeIds(prevIds => [...prevIds, meal.recipeId]);
          }
          
          setTripMealRecipeIds(prevMap => {
            const newMap = new Map(prevMap);
            newMap.set(mealId, meal.recipeId);
            return newMap;
          });
        }
        return [...prev, mealId];
      }
    });
  }

  // Move to confirmation step
  // MULTI-MEAL INGREDIENT AGGREGATION:
  // This function collects ingredients from ALL selected sources:
  // 1. Manually selected recipes from "My Recipes"
  // 2. Internal trip meals (recipes with recipeId)
  // 3. External trip meals (WordPress recipes - prefetched via React Query)
  // 4. RecipeDetail/TripDetail payloads (from ingredient picker modal)
  function proceedToConfirmation() {
    if (selectedRecipeIds.length === 0 && externalMealsTitles.length === 0) return;
    
    // Block navigation if external ingredients are still loading
    if (externalIngredientsLoading) {
      console.warn('[GroceryAggregation] External ingredients still loading, please wait...');
      toast({
        title: "Please wait",
        description: "Fetching ingredients from external recipes...",
        variant: "default",
      });
      return;
    }
    
    // Block navigation if any external ingredient fetch failed
    if (externalIngredientsError) {
      console.error('[GroceryAggregation] Some external ingredients failed to load');
      toast({
        title: "Failed to load ingredients",
        description: `Could not fetch ingredients for ${failedExternalMeals.length} external meal(s). Please try again.`,
        variant: "destructive",
      });
      return;
    }
    
    // Build alreadyHaveSet from session storage and extended payload
    let alreadyHaveSet = new Set<string>();
    
    // Gather ingredients from selected internal recipes
    const recipeIngredients = selectedRecipeIds
      .map(id => {
        // Check if this is the recipe from RecipeDetail/TripDetail
        if (recipeDetailIngredients && recipeDetailIngredients.recipeId === id) {
          if (recipeDetailIngredients.kind === "extended") {
            // Extended payload from TripDetail: use ALL ingredients, seed pantry metadata
            alreadyHaveSet = new Set([...Array.from(alreadyHaveSet), ...recipeDetailIngredients.alreadyHaveNormalized]);
            return {
              recipeId: recipeDetailIngredients.recipeId,
              recipeTitle: recipeDetailIngredients.recipeTitle,
              ingredients: recipeDetailIngredients.allIngredients,  // ALL ingredients (needed + pantry)
            };
          } else {
            // Minimal payload from RecipeDetail: use ONLY selected ingredients
            return {
              recipeId: recipeDetailIngredients.recipeId,
              recipeTitle: recipeDetailIngredients.recipeTitle,
              ingredients: recipeDetailIngredients.ingredients,  // ONLY selected ingredients
            };
          }
        }
        
        // Otherwise use full recipe from the list
        const recipe = recipes?.find(r => r.id === id);
        if (!recipe) return null;
        return {
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          ingredients: recipe.ingredients, // Use all ingredients
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    
    // ADD EXTERNAL MEAL INGREDIENTS (from prefetched React Query cache):
    // For each selected trip meal, if it's an external WordPress recipe,
    // get its ingredients from the cached query result
    selectedExternalMeals.forEach((meal, index) => {
      const queryResult = externalIngredientsQueries[index];
      
      if (queryResult.data?.ingredients && Array.isArray(queryResult.data.ingredients)) {
        const ingredients = queryResult.data.ingredients;
        recipeIngredients.push({
          recipeId: 0, // Synthetic ID for external meals
          recipeTitle: meal.title,
          ingredients,
        });
        console.info(`[GroceryAggregation] Added ${ingredients.length} ingredients from external meal "${meal.title}"`);
      } else {
        console.warn(`[GroceryAggregation] No ingredients found for external meal "${meal.title}"`);
      }
    });

    // LOG AGGREGATION SUMMARY for verification
    console.info(`[GroceryAggregation] === MULTI-MEAL AGGREGATION SUMMARY ===`);
    console.info(`[GroceryAggregation] Processing ${recipeIngredients.length} meals/recipes total`);
    console.info(`[GroceryAggregation] - Internal recipes: ${selectedRecipeIds.length}`);
    console.info(`[GroceryAggregation] - External meals: ${selectedExternalMeals.length}`);
    console.info(`[GroceryAggregation] - From ingredient picker: ${recipeDetailIngredients ? 1 : 0}`);
    
    const totalIngredientsBeforeMerge = recipeIngredients.reduce((sum, r) => sum + r.ingredients.length, 0);
    console.info(`[GroceryAggregation] Total ingredients before merge: ${totalIngredientsBeforeMerge}`);

    // Merge ingredients (combines duplicates, sums amounts)
    const merged = mergeIngredients(recipeIngredients);
    console.info(`[GroceryAggregation] Total unique ingredients after merge: ${merged.length}`);
    
    // Read "already have" ingredients from sessionStorage ONLY for minimal flows (RecipeDetail standalone)
    if (recipeDetailIngredients?.kind === "minimal" || !recipeDetailIngredients) {
      try {
        const alreadyHaveData = sessionStorage.getItem('alreadyHaveIngredients');
        if (alreadyHaveData) {
          const parsed = JSON.parse(alreadyHaveData);
          // RecipeDetail stores normalized keys for robust matching (handles amounts, punctuation, etc.)
          if (Array.isArray(parsed.normalizedKeys)) {
            alreadyHaveSet = new Set([...Array.from(alreadyHaveSet), ...parsed.normalizedKeys]);
          }
          // Clear after reading to prevent stale data
          sessionStorage.removeItem('alreadyHaveIngredients');
        }
      } catch (err) {
        console.error('Failed to parse alreadyHaveIngredients:', err);
      }
    }
    // For extended payloads, alreadyHaveSet was already seeded above - don't clear it
    
    // Initialize confirmed ingredients, marking alreadyHave items as not needed
    const confirmed: ConfirmedIngredient[] = merged.map(ing => {
      // Use normalized key for matching (same normalization as RecipeDetail and mergeIngredients)
      const normalizedKey = normalizeIngredientKey(ing.name);
      const isAlreadyOwned = alreadyHaveSet.has(normalizedKey);
      
      return {
        ...ing,
        isNeeded: !isAlreadyOwned, // If already owned, set isNeeded to false
      };
    });
    
    setConfirmedIngredients(confirmed);
    setCurrentStep(Step.CONFIRMATION);
    
    // Clear pending grocery items from sessionStorage now that we've processed them
    sessionStorage.removeItem('pendingGroceryItems');
  }

  function toggleIngredientNeeded(index: number) {
    setConfirmedIngredients(prev => {
      const newConfirmed = [...prev];
      newConfirmed[index] = {
        ...newConfirmed[index],
        isNeeded: !newConfirmed[index].isNeeded,
      };
      return newConfirmed;
    });
  }

  function selectAllIngredients() {
    setConfirmedIngredients(prev => prev.map(ing => ({ ...ing, isNeeded: true })));
  }

  // Mutation to save grocery list to database
  const saveGroceryListMutation = useMutation({
    mutationFn: async (items: GroceryItem[]) => {
      const selectedTrip = selectedTripId ? trips.find(t => t.id.toString() === selectedTripId) : null;
      
      const response = await apiRequest("POST", "/api/grocery-lists", {
        items,
        tripId: selectedTrip?.id,
        tripName: selectedTrip?.name,
      });
      
      const data = await response.json();
      return data as { token: string; id: number; listUrl: string };
    },
    onSuccess: (data) => {
      console.log(`[GrocerySelection] Saved list with token: ${data.token}`);
      
      // Invalidate usage stats to reflect new grocery list count
      queryClient.invalidateQueries({ queryKey: ["/api/account/usage"] });
      
      // Clear any pending grocery data from sessionStorage
      sessionStorage.removeItem('confirmedGroceryData');
      sessionStorage.removeItem('pendingGroceryItems');
      sessionStorage.removeItem('alreadyHaveIngredients');
      
      // Navigate to the saved list
      setLocation(`/grocery/list/${data.token}`);
    },
    onError: async (error: any) => {
      console.error('[GrocerySelection] Error saving list:', error);
      
      // Handle paywall (402)
      if (error.status === 402) {
        const errorData = await error.response?.json().catch(() => ({}));
        const message = errorData.message || "You've reached the free limit of 5 shared grocery lists. Start a free trial to create unlimited lists.";
        
        toast({
          title: "Upgrade Required",
          description: message,
          variant: "destructive",
        });
        
        // Redirect to subscribe page
        setLocation("/subscribe");
        return;
      }
      
      // Handle other errors
      toast({
        title: "Failed to save list",
        description: "Your grocery list could not be saved. Please try again.",
        variant: "destructive",
      });
    },
  });

  function generateFinalList() {
    // Convert confirmed ingredients to GroceryItem format
    const needed = confirmedIngredients.filter(ing => ing.isNeeded);
    const pantry = confirmedIngredients.filter(ing => !ing.isNeeded);
    
    // Build GroceryItem array with proper format, categorizing each ingredient
    const neededItems: GroceryItem[] = needed.map(ing => ({
      name: ing.name,
      category: categorizeIngredient(ing.name),
      checked: false,
    }));
    
    const pantryItems: GroceryItem[] = pantry.map(ing => ({
      name: ing.name,
      category: categorizeIngredient(ing.name),
      checked: true, // Pantry items are marked as "already have"
    }));
    
    // Add external meal titles as Pantry items
    const externalItems: GroceryItem[] = externalMealsTitles.map(title => ({
      name: title + " (see trip for recipe details)",
      category: "Pantry",
      checked: false,
    }));
    
    const allItems = [...neededItems, ...pantryItems, ...externalItems];
    
    console.log(`[GrocerySelection] Saving ${allItems.length} items to database...`);
    
    // Save to database via API
    saveGroceryListMutation.mutate(allItems);
  }

  function backToSelection() {
    setCurrentStep(Step.SELECTION);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-6 md:px-10 py-12 pt-24">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  // Check if there are any recipes OR pending grocery items from ingredient picker
  // Check sessionStorage directly (not state) because state is populated in useEffect AFTER render
  const hasPendingGroceryItems = (() => {
    try {
      const pendingData = sessionStorage.getItem('pendingGroceryItems');
      return !!pendingData && pendingData !== 'null';
    } catch {
      return false;
    }
  })();
  const hasSelectedRecipes = selectedRecipeIds.length > 0;
  
  // Only show "No Recipes Yet" if user has no recipes AND no pending items from ingredient picker
  if (!recipes || (recipes.length === 0 && !hasPendingGroceryItems && !hasSelectedRecipes)) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl pt-24">
          <div className="text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Recipes Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create some recipes first, then come back to build your grocery list!
            </p>
            <Button onClick={() => setLocation("/new")} data-testid="button-create-recipe">
              Create Your First Recipe
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Render confirmation step
  if (currentStep === Step.CONFIRMATION) {
    const needed = confirmedIngredients.filter(ing => ing.isNeeded);
    const pantry = confirmedIngredients.filter(ing => !ing.isNeeded);

    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl pt-24">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={backToSelection}
              className="mb-4"
              data-testid="button-back-to-selection"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Selection
            </Button>
            <h1 className="text-4xl font-bold mb-2">Confirm Your Ingredients</h1>
            <p className="text-lg text-muted-foreground">
              Review and adjust your grocery list. Uncheck items you already have.
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Ingredients</CardTitle>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllIngredients}
                    data-testid="button-select-all-ingredients"
                  >
                    Select All
                  </Button>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="pantry-toggle"
                      checked={moveUncheckedToPantry}
                      onCheckedChange={setMoveUncheckedToPantry}
                      data-testid="switch-pantry-toggle"
                    />
                    <Label htmlFor="pantry-toggle" className="text-sm cursor-pointer">
                      Move unchecked to "Already Have It"
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {confirmedIngredients.map((ing, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-md hover-elevate"
                  data-testid={`ingredient-item-${idx}`}
                >
                  <Checkbox
                    id={`ingredient-${idx}`}
                    checked={ing.isNeeded}
                    onCheckedChange={() => toggleIngredientNeeded(idx)}
                    data-testid={`checkbox-ingredient-${idx}`}
                  />
                  <label htmlFor={`ingredient-${idx}`} className="flex-1 cursor-pointer">
                    <div className="font-semibold">{ing.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {ing.amounts.length > 1 ? (
                        <span>
                          {ing.amounts.map((amt, i) => (
                            <span key={i}>
                              {amt} ({ing.recipes[i]?.title})
                              {i < ing.amounts.length - 1 ? ' + ' : ''}
                            </span>
                          ))}
                          {ing.combinedAmount && <span> → {ing.combinedAmount} total</span>}
                        </span>
                      ) : ing.amounts.length === 1 ? (
                        <span>{ing.amounts[0]} ({ing.recipes[0]?.title})</span>
                      ) : (
                        <span>From: {ing.recipes.map(r => r.title).join(', ')}</span>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          {moveUncheckedToPantry && pantry.length > 0 && (
            <Card className="mb-6 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-amber-600 dark:text-amber-400">
                  Already in Your Pantry ({pantry.length})
                </CardTitle>
                <CardDescription>
                  These items will be listed separately as items you already have
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {pantry.map((ing, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      • {ing.name}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={backToSelection}
              data-testid="button-cancel-confirmation"
            >
              Cancel
            </Button>
            <Button
              onClick={generateFinalList}
              disabled={needed.length === 0 || saveGroceryListMutation.isPending}
              className="gap-2"
              data-testid="button-generate-final-list"
            >
              {saveGroceryListMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving list...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Generate Grocery List ({needed.length} items)
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Render selection step
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl pt-24">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Build Your Grocery List</h1>
          <p className="text-lg text-muted-foreground">
            Select recipes from your trips or your recipe collection to create a combined shopping list.
          </p>
        </div>

        {trips.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Meals from your trips</CardTitle>
              <CardDescription>
                Select a trip to add its planned meals to your grocery list
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                  <SelectTrigger data-testid="select-trip">
                    <SelectValue placeholder="Choose a trip..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id.toString()}>
                        {trip.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTripId && tripMeals.length > 0 && (
                <div className="space-y-3 pt-2">
                  {tripMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-start gap-3 p-3 rounded-md hover-elevate"
                      data-testid={`trip-meal-item-${meal.id}`}
                    >
                      <Checkbox
                        id={`trip-meal-${meal.id}`}
                        checked={selectedTripMealIds.includes(meal.id)}
                        onCheckedChange={() => toggleTripMeal(meal.id, meal)}
                        data-testid={`checkbox-trip-meal-${meal.id}`}
                      />
                      <label
                        htmlFor={`trip-meal-${meal.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-semibold mb-1">{meal.title}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {meal.isExternal && (
                            <Badge variant="outline" className="text-xs">
                              External Recipe
                            </Badge>
                          )}
                          {meal.sourceUrl && (
                            <a
                              href={meal.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View recipe <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {selectedTripId && tripMeals.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No meals planned for this trip yet. Add recipes to your trip from the Recipes page.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Recipes</CardTitle>
            <CardDescription>
              Choose one or more recipes to include in your grocery list
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipes.map((recipe) => {
              const isManuallySelected = manuallySelectedRecipeIds.has(recipe.id);
              const isInTripMeals = Array.from(tripMealRecipeIds.values()).includes(recipe.id);
              
              return (
                <div
                  key={recipe.id}
                  className="flex items-start gap-3 p-3 rounded-md hover-elevate"
                  data-testid={`recipe-item-${recipe.id}`}
                >
                  <Checkbox
                    id={`recipe-${recipe.id}`}
                    checked={isManuallySelected}
                    onCheckedChange={() => toggleRecipe(recipe.id)}
                    data-testid={`checkbox-recipe-${recipe.id}`}
                  />
                  <label
                    htmlFor={`recipe-${recipe.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-semibold mb-1">{recipe.title}</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {recipe.ingredients.length} ingredients
                      </Badge>
                      {isInTripMeals && !isManuallySelected && (
                        <Badge variant="outline" className="text-xs">
                          In trip meals
                        </Badge>
                      )}
                    </div>
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {externalIngredientsError && failedExternalMeals.length > 0 && (
          <Alert variant="destructive" className="mb-4" data-testid="alert-external-ingredients-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load external recipe ingredients</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                Could not fetch ingredients for {failedExternalMeals.length} external meal(s): 
                {failedExternalMeals.map(m => m.title).join(", ")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={retryFailedQueries}
                data-testid="button-retry-external-ingredients"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={proceedToConfirmation}
            disabled={
              (selectedRecipeIds.length === 0 && externalMealsTitles.length === 0) ||
              externalIngredientsLoading
            }
            className="gap-2"
            data-testid="button-proceed-to-confirm"
          >
            {externalIngredientsLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching ingredients...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Continue to Review
                {(selectedRecipeIds.length > 0 || externalMealsTitles.length > 0) &&
                  ` (${selectedRecipeIds.length + externalMealsTitles.length})`}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
