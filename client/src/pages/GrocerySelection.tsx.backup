import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Loader2, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import type { Recipe, Trip } from "@shared/schema";

// Page for selecting recipes to generate a grocery list
// Users can select multiple recipes and generate a combined shopping list
export default function GrocerySelection() {
  const [, setLocation] = useLocation();
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);
  const [manuallySelectedRecipeIds, setManuallySelectedRecipeIds] = useState<Set<number>>(new Set()); // Track manual selections
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [selectedTripMealIds, setSelectedTripMealIds] = useState<number[]>([]);
  const [externalMealsTitles, setExternalMealsTitles] = useState<string[]>([]);
  // Track ALL trip meal -> recipe mappings (even if recipe already selected)
  const [tripMealRecipeIds, setTripMealRecipeIds] = useState<Map<number, number>>(new Map()); // mealId -> recipeId

  // Fetch all available recipes
  // Always refetch on mount to ensure we have the latest recipes
  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    refetchOnMount: true,
  });

  // Fetch all trips for the dropdown
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
  });

  // Fetch trip meals when a trip is selected
  const { data: tripMeals = [] } = useQuery<any[]>({
    queryKey: ["/api/trips", selectedTripId, "meals"],
    enabled: !!selectedTripId,
  });

  // Toggle recipe selection (manual)
  function toggleRecipe(recipeId: number) {
    const isManuallySelected = manuallySelectedRecipeIds.has(recipeId);
    
    if (isManuallySelected) {
      // User is unchecking manual selection
      setManuallySelectedRecipeIds(prevManual => {
        const newManual = new Set(prevManual);
        newManual.delete(recipeId);
        return newManual;
      });
      
      // Check if any trip meals still reference this recipe
      const isInTripMeals = Array.from(tripMealRecipeIds.values()).includes(recipeId);
      
      // Only remove from selectedRecipeIds if no trip meals need it
      if (!isInTripMeals) {
        setSelectedRecipeIds(prev => prev.filter(id => id !== recipeId));
      }
    } else {
      // User is checking manual selection
      setManuallySelectedRecipeIds(prevManual => new Set(prevManual).add(recipeId));
      
      // Add to selectedRecipeIds if not already there (from trip meals)
      setSelectedRecipeIds(prev => {
        if (!prev.includes(recipeId)) {
          return [...prev, recipeId];
        }
        return prev;
      });
    }
  }

  // Toggle trip meal selection
  function toggleTripMeal(mealId: number, meal: any) {
    setSelectedTripMealIds(prev => {
      const isSelected = prev.includes(mealId);
      
      if (isSelected) {
        // Remove meal
        if (meal.isExternal && !meal.recipeId) {
          // Remove external meal title from titles list
          setExternalMealsTitles(prevTitles => 
            prevTitles.filter(title => title !== meal.title)
          );
        } else if (meal.recipeId) {
          // Remove trip meal mapping
          setTripMealRecipeIds(prevMap => {
            const newMap = new Map(prevMap);
            newMap.delete(mealId);
            
            // Check if this recipe is still needed
            const isInOtherMeals = Array.from(newMap.values()).includes(meal.recipeId);
            const isManuallySelected = manuallySelectedRecipeIds.has(meal.recipeId);
            
            // Only remove from selectedRecipeIds if:
            // - No other trip meals use this recipe AND
            // - User didn't manually select it
            if (!isInOtherMeals && !isManuallySelected) {
              setSelectedRecipeIds(prevIds => 
                prevIds.filter(id => id !== meal.recipeId)
              );
            }
            
            return newMap;
          });
        }
        return prev.filter(id => id !== mealId);
      } else {
        // Add meal
        if (meal.isExternal && !meal.recipeId) {
          // Add external meal title to titles list
          setExternalMealsTitles(prevTitles => [...prevTitles, meal.title]);
        } else if (meal.recipeId) {
          // Check if recipe is already selected
          const wasAlreadySelected = selectedRecipeIds.includes(meal.recipeId);
          
          if (!wasAlreadySelected) {
            // Add to selected recipes only if not already there
            setSelectedRecipeIds(prevIds => [...prevIds, meal.recipeId]);
          }
          
          // ALWAYS track this mapping (even if recipe already selected)
          // This allows us to count how many trip meals reference this recipe
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

  // Generate grocery list and navigate to list page
  function handleGenerateList() {
    if (selectedRecipeIds.length === 0 && externalMealsTitles.length === 0) return;
    
    // Navigate to grocery list page with selected recipe IDs and external meal titles
    const params = new URLSearchParams();
    selectedRecipeIds.forEach(id => params.append("recipeIds", id.toString()));
    externalMealsTitles.forEach(title => params.append("externalMeals", title));
    setLocation(`/grocery/list?${params.toString()}`);
  }

  if (isLoading) {
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

  if (!recipes || recipes.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Build Your Grocery List</h1>
        <p className="text-lg text-muted-foreground">
          Select recipes from your trips or your recipe collection to create a combined shopping list.
        </p>
      </div>

      {/* Trip Meals Section */}
      {trips.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Meals from your trips</CardTitle>
            <CardDescription>
              Select a trip to add its planned meals to your grocery list
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trip Selector */}
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

            {/* Meals List */}
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

      {/* Recipe Selection */}
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

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerateList}
          disabled={selectedRecipeIds.length === 0 && externalMealsTitles.length === 0}
          data-testid="button-generate-list"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Generate Grocery List ({selectedRecipeIds.length + externalMealsTitles.length})
        </Button>
      </div>
      </main>
    </div>
  );
}
