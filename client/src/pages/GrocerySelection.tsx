import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2 } from "lucide-react";
import type { Recipe } from "@shared/schema";

// Page for selecting recipes to generate a grocery list
// Users can select multiple recipes and generate a combined shopping list
export default function GrocerySelection() {
  const [, setLocation] = useLocation();
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([]);

  // Fetch all available recipes
  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  // Toggle recipe selection
  function toggleRecipe(recipeId: number) {
    setSelectedRecipeIds(prev => 
      prev.includes(recipeId)
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  }

  // Generate grocery list and navigate to list page
  function handleGenerateList() {
    if (selectedRecipeIds.length === 0) return;
    
    // Navigate to grocery list page with selected recipe IDs
    const params = new URLSearchParams();
    selectedRecipeIds.forEach(id => params.append("recipeIds", id.toString()));
    setLocation(`/grocery/list?${params.toString()}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Build Your Grocery List</h1>
        <p className="text-lg text-muted-foreground">
          Select the recipes you're planning to cook, and we'll create a combined shopping list for you.
        </p>
      </div>

      {/* Recipe Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Recipes</CardTitle>
          <CardDescription>
            Choose one or more recipes to include in your grocery list
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex items-start gap-3 p-3 rounded-md hover-elevate"
              data-testid={`recipe-item-${recipe.id}`}
            >
              <Checkbox
                id={`recipe-${recipe.id}`}
                checked={selectedRecipeIds.includes(recipe.id)}
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
                </div>
              </label>
            </div>
          ))}
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
          disabled={selectedRecipeIds.length === 0}
          data-testid="button-generate-list"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Generate Grocery List ({selectedRecipeIds.length})
        </Button>
      </div>
    </div>
  );
}
