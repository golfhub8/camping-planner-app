import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, Printer, ChefHat, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

export default function RecipeDetail() {
  const params = useParams();
  const recipeId = parseInt(params.id || "1");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Fetch the specific recipe from the API
  const { data: recipe, isLoading } = useQuery<Recipe>({
    queryKey: ["/api/recipes", recipeId],
    queryFn: async () => {
      const response = await fetch(`/api/recipes/${recipeId}`);
      if (!response.ok) {
        throw new Error("Recipe not found");
      }
      return response.json();
    },
  });
  
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const selectAllIngredients = () => {
    if (!recipe) return;
    const allIndices = new Set(recipe.ingredients.map((_, idx) => idx));
    setCheckedIngredients(allIndices);
  };

  const handlePrint = () => {
    window.print();
  };

  // Add selected ingredients to grocery list
  const addToGroceryList = () => {
    if (!recipe) return;
    
    // Get checked ingredients (the ones user wants to add)
    const selectedIngredients = recipe.ingredients
      .filter((_, idx) => checkedIngredients.has(idx));
    
    if (selectedIngredients.length === 0) {
      toast({
        title: "No ingredients selected",
        description: "Please check the ingredients you want to add to your grocery list.",
        variant: "destructive",
      });
      return;
    }

    // Store recipe with selected ingredients in sessionStorage
    // Format matches what GrocerySelection expects for mergeIngredients
    const groceryData = {
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      ingredients: selectedIngredients // Array of ingredient strings with amounts
    };
    
    sessionStorage.setItem('pendingGroceryItems', JSON.stringify(groceryData));
    
    // Navigate to grocery page
    setLocation("/grocery");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading recipe...</div>
        </main>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Recipe Not Found</h1>
            <Link href="/">
              <Button>Back to Recipes</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const steps = recipe.steps.split('\n').filter(s => s.trim());

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/" data-testid="link-back">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Recipes
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-foreground" data-testid="text-recipe-title">
              {recipe.title}
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="default" className="gap-1" data-testid="badge-ingredient-count">
                <ChefHat className="h-3 w-3" />
                {recipe.ingredients.length} ingredients
              </Badge>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-created-date">
                <Calendar className="h-4 w-4" />
                Created {formatDistanceToNow(new Date(recipe.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Ingredients
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Check off what you already have
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {recipe.ingredients.map((ingredient, idx) => (
                    <li key={idx} className="flex items-start gap-3" data-testid={`ingredient-${idx}`}>
                      <Checkbox
                        id={`ingredient-${idx}`}
                        checked={checkedIngredients.has(idx)}
                        onCheckedChange={() => toggleIngredient(idx)}
                        className="mt-1"
                        data-testid={`checkbox-ingredient-${idx}`}
                      />
                      <label
                        htmlFor={`ingredient-${idx}`}
                        className={`flex-1 cursor-pointer select-none ${
                          checkedIngredients.has(idx) ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {ingredient}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={selectAllIngredients}
                    className="flex-1"
                    data-testid="button-select-all"
                  >
                    Select All
                  </Button>
                  <Button
                    onClick={addToGroceryList}
                    className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-add-to-grocery"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add Selected to Grocery
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="font-bold">Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {steps.map((step, idx) => (
                    <li key={idx} className="flex gap-4" data-testid={`step-${idx}`}>
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {idx + 1}
                      </div>
                      <p className="flex-1 pt-1">{step.replace(/^\d+\.\s*/, '')}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
