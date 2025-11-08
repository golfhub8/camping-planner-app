import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, Printer, ChefHat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import Header from "@/components/Header";
import type { Recipe } from "@shared/schema";

export default function RecipeDetail() {
  const params = useParams();
  const recipeId = parseInt(params.id || "1");
  
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

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading recipe...</div>
        </main>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-bold mb-4">Recipe Not Found</h1>
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
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12">
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
            <h1 className="text-5xl font-serif font-bold text-foreground" data-testid="text-recipe-title">
              {recipe.title}
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <Badge variant="secondary" className="gap-1" data-testid="badge-ingredient-count">
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
                <CardTitle className="flex items-center gap-2 font-serif">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Ingredients
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="font-serif">Steps</CardTitle>
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
