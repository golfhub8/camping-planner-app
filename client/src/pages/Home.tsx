import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import RecipeCard from "@/components/RecipeCard";
import RecipeForm from "@/components/RecipeForm";
import EmptyState from "@/components/EmptyState";
import Header from "@/components/Header";
import ExternalRecipeViewer from "@/components/ExternalRecipeViewer";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Recipe } from "@shared/schema";

// Type definition for external recipes from WordPress
// These recipes come from TheCampingPlanner.com and have a different structure
interface ExternalRecipe {
  id: string; // WordPress post ID (prefixed with "wp-")
  title: string;
  source: "external";
  url: string; // Link to the full recipe on TheCampingPlanner.com
  ingredients?: string[]; // May not be available for external recipes
}

export default function Home() {
  const recipeFormRef = useRef<HTMLDivElement>(null);
  
  // State for search query - filters recipes by title and ingredients
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for viewing external recipe details in modal
  // When set to a recipe ID (e.g., "wp-12345"), the modal opens
  const [viewingExternalRecipeId, setViewingExternalRecipeId] = useState<string | null>(null);

  // Fetch user's own recipes from the database
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  // Fetch external camping recipes from TheCampingPlanner.com WordPress site
  // This query runs independently and gracefully handles errors
  const { data: externalRecipes = [] } = useQuery<ExternalRecipe[]>({
    queryKey: ["/api/recipes/external"],
  });

  // Mutation for creating a new recipe
  const createRecipeMutation = useMutation({
    mutationFn: async (newRecipe: { title: string; ingredients: string[]; steps: string }) => {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRecipe),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create recipe");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch recipes after creating a new one
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const handleCreateRecipe = (newRecipe: { title: string; ingredients: string[]; steps: string }) => {
    createRecipeMutation.mutate(newRecipe);
  };

  const scrollToRecipeForm = () => {
    recipeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus the form after scrolling
    setTimeout(() => {
      const firstInput = recipeFormRef.current?.querySelector('input, textarea');
      if (firstInput instanceof HTMLElement) {
        firstInput.focus();
      }
    }, 500);
  };

  // Filter user recipes based on search query
  // Searches in both recipe title and ingredients list
  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    
    const query = searchQuery.toLowerCase();
    return recipes.filter(recipe => {
      // Check if title matches
      const titleMatch = recipe.title.toLowerCase().includes(query);
      
      // Check if any ingredient matches
      const ingredientMatch = recipe.ingredients.some(ingredient =>
        ingredient.toLowerCase().includes(query)
      );
      
      return titleMatch || ingredientMatch;
    });
  }, [recipes, searchQuery]);

  // Filter external recipes based on search query
  // Only searches titles since ingredients may not be available
  const filteredExternalRecipes = useMemo(() => {
    if (!searchQuery.trim()) return externalRecipes;
    
    const query = searchQuery.toLowerCase();
    return externalRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(query)
    );
  }, [externalRecipes, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading recipes...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold text-foreground" data-testid="text-page-title">
            Camp Recipes
          </h1>
          <p className="text-muted-foreground" data-testid="text-recipe-count">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in your collection
          </p>
        </div>

        {/* Search bar - filters recipes by title and ingredients */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search recipes by name or ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-recipes"
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto" ref={recipeFormRef}>
          <RecipeForm onSubmit={handleCreateRecipe} />
        </div>

        {/* User's own recipes section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-section-my-recipes">
              My Recipes
            </h2>
          </div>

          {filteredRecipes.length === 0 ? (
            searchQuery ? (
              <div className="text-center py-12 text-muted-foreground">
                No recipes found matching "{searchQuery}"
              </div>
            ) : (
              <EmptyState
                message="No recipes yet. Create your first camping recipe!"
                actionLabel="Get Started"
                onAction={scrollToRecipeForm}
              />
            )
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  ingredients={recipe.ingredients}
                  createdAt={new Date(recipe.createdAt)}
                  source="internal"
                />
              ))}
            </div>
          )}
        </div>

        {/* External recipes from TheCampingPlanner.com */}
        {filteredExternalRecipes.length > 0 && (
          <div className="space-y-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground" data-testid="text-section-external-recipes">
                From TheCampingPlanner.com
              </h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredExternalRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  id={recipe.id}
                  title={recipe.title}
                  ingredients={recipe.ingredients || []}
                  source="external"
                  url={recipe.url}
                  onViewExternal={() => setViewingExternalRecipeId(recipe.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* External Recipe Viewer Modal */}
      <ExternalRecipeViewer
        recipeId={viewingExternalRecipeId}
        onClose={() => setViewingExternalRecipeId(null)}
      />
    </div>
  );
}
