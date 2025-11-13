import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChefHat, Clock, Save, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Type for shared recipe (sanitized, no userId or shareToken)
// Note: createdAt comes as ISO string from JSON, not Date object
type SharedRecipe = {
  id: number;
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl: string | null;
  sourceUrl: string | null;
  createdAt: string;
};

export default function SharedRecipe() {
  const [, params] = useRoute("/recipes/shared/:token");
  const { toast } = useToast();
  const token = params?.token;

  // Fetch shared recipe
  const { data: recipe, isLoading, error } = useQuery<SharedRecipe>({
    queryKey: [`/api/recipes/shared/${token}`],
    enabled: !!token,
  });

  // Save recipe to user's collection
  const saveRecipeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/recipes/shared/${token}/save`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save recipe");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recipe Saved!",
        description: "This recipe has been added to your collection",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save recipe",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Recipe Not Found</CardTitle>
            <CardDescription>
              This shared recipe link may be invalid or has been removed
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <a href="/">Go Home</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold" data-testid="text-recipe-title">
              {recipe.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="default" className="gap-1">
                <ChefHat className="h-3 w-3" />
                {recipe.ingredients.length} ingredients
              </Badge>
              {recipe.createdAt && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(recipe.createdAt), { addSuffix: true })}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={() => saveRecipeMutation.mutate()}
            disabled={saveRecipeMutation.isPending}
            size="lg"
            className="gap-2"
            data-testid="button-save-recipe"
          >
            <Save className="h-5 w-5" />
            {saveRecipeMutation.isPending ? "Saving..." : "Save to My Recipes"}
          </Button>
        </div>

        {/* Recipe Image */}
        {recipe.imageUrl && (
          <Card className="overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-96 object-cover"
              data-testid="img-recipe"
            />
          </Card>
        )}

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient: string, idx: number) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-base"
                  data-testid={`text-ingredient-${idx}`}
                >
                  <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {recipe.steps.map((step: string, idx: number) => (
                <li
                  key={idx}
                  className="flex items-start gap-4 text-base"
                  data-testid={`text-step-${idx}`}
                >
                  <Badge variant="secondary" className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center">
                    {idx + 1}
                  </Badge>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Source Link */}
        {recipe.sourceUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="gap-2">
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View Original Recipe
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Save Again Button at Bottom */}
        <div className="flex justify-center pt-8">
          <Button
            onClick={() => saveRecipeMutation.mutate()}
            disabled={saveRecipeMutation.isPending}
            size="lg"
            className="gap-2"
          >
            <Save className="h-5 w-5" />
            {saveRecipeMutation.isPending ? "Saving..." : "Save to My Recipes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
