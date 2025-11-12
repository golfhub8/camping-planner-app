import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Printer, ChefHat, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";
import IngredientPickerModal from "@/components/IngredientPickerModal";

export default function RecipeDetail() {
  const params = useParams();
  const recipeId = parseInt(params.id || "1");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // State for ingredient picker modal
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);
  
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

  const handlePrint = () => {
    window.print();
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

  // Recipe steps are now stored as an array
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  
  // Show source URL badge if available
  const hasSourceUrl = recipe.sourceUrl && recipe.sourceUrl.length > 0;

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
              {steps.length > 0 && (
                <Badge variant="secondary" className="gap-1" data-testid="badge-step-count">
                  {steps.length} steps
                </Badge>
              )}
              {hasSourceUrl && (
                <Badge variant="outline" className="gap-1" data-testid="badge-saved-from-web">
                  Saved from web
                </Badge>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-created-date">
                <Calendar className="h-4 w-4" />
                Created {formatDistanceToNow(new Date(recipe.createdAt), { addSuffix: true })}
              </div>
            </div>
            {hasSourceUrl && (
              <p className="text-sm text-muted-foreground">
                Source: <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary" data-testid="link-source-url">{recipe.sourceUrl}</a>
              </p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Ingredients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {recipe.ingredients.map((ingredient, idx) => (
                    <li key={idx} className="flex items-start gap-2" data-testid={`ingredient-${idx}`}>
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                      <span className="flex-1">{ingredient}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => setIngredientPickerOpen(true)}
                  className="w-full gap-2"
                  data-testid="button-add-to-grocery"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Grocery List
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="font-bold">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                {steps.length > 0 ? (
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
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No instructions available for this recipe. Add them by editing the recipe.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Ingredient Picker Modal */}
      <IngredientPickerModal
        open={ingredientPickerOpen}
        onOpenChange={setIngredientPickerOpen}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        ingredients={recipe.ingredients}
      />
    </div>
  );
}
