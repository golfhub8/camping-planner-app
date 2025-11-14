import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { normalizeIngredients, normalizeSteps } from "@/lib/recipeNormalizer";

interface RecipeFormProps {
  onSubmit?: (recipe: { title: string; ingredients: string[]; steps: string[] }) => void;
}

export default function RecipeForm({ onSubmit }: RecipeFormProps) {
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");

  // Auto-expand form when navigating with createNew=true query param
  // Only expands when param is explicitly true, never interferes with manual expansion
  useEffect(() => {
    const queryString = location.includes('?') ? location.split('?')[1] : '';
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      const shouldExpand = searchParams.get('createNew') === 'true';
      if (shouldExpand) {
        setIsExpanded(true);
      }
    }
  }, [location]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use shared normalization utility for consistent formatting
    const ingredientsArray = normalizeIngredients(ingredients);
    const stepsArray = normalizeSteps(steps);

    if (onSubmit) {
      onSubmit({ title, ingredients: ingredientsArray, steps: stepsArray });
    }

    setTitle("");
    setIngredients("");
    setSteps("");
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <Card className="hover-elevate">
        <CardHeader>
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-3"
            onClick={() => setIsExpanded(true)}
            data-testid="button-expand-form"
          >
            <div className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">Create New Recipe</span>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </Button>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-bold">
              <PlusCircle className="h-5 w-5 text-primary" />
              Create New Recipe
            </CardTitle>
            <CardDescription>
              Add a new camping recipe to your collection
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(false)}
            data-testid="button-collapse-form"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Recipe Title
            </Label>
            <Input
              id="title"
              placeholder="e.g., Campfire S'mores"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              data-testid="input-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients" className="text-sm font-medium">
              Ingredients
            </Label>
            <Textarea
              id="ingredients"
              placeholder="Enter each ingredient on a new line&#10;e.g.,&#10;2 cups flour&#10;1 cup sugar&#10;3 eggs"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={6}
              required
              data-testid="input-ingredients"
            />
            <p className="text-xs text-muted-foreground">
              Enter each ingredient on a separate line
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="steps" className="text-sm font-medium">
              Steps
            </Label>
            <Textarea
              id="steps"
              placeholder="Describe how to prepare this recipe...&#10;&#10;1. First step&#10;2. Second step&#10;3. Final step"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={10}
              required
              data-testid="input-steps"
            />
            <p className="text-xs text-muted-foreground">
              Describe the preparation steps in detail
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" data-testid="button-submit">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Recipe
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTitle("");
                setIngredients("");
                setSteps("");
                setIsExpanded(false);
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
