import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import RecipeCard from "@/components/RecipeCard";
import RecipeForm from "@/components/RecipeForm";
import EmptyState from "@/components/EmptyState";
import ExternalRecipeViewer from "@/components/ExternalRecipeViewer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Type definition for external recipes from WordPress
// These recipes come from TheCampingPlanner.com and have a different structure
interface ExternalRecipe {
  id: string; // WordPress post ID (prefixed with "wp-")
  title: string;
  source: "external";
  url: string; // Link to the full recipe on TheCampingPlanner.com
  ingredients?: string[]; // May not be available for external recipes
  content?: string; // Recipe instructions/content from WordPress
}

export default function Home() {
  const recipeFormRef = useRef<HTMLDivElement>(null);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Parse trip context from query params
  const tripContext = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const tripId = params.get('fromTripId');
    const tripName = params.get('fromTripName');
    return tripId && tripName ? { tripId: parseInt(tripId), tripName } : null;
  }, [location]);
  
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
  const { data: externalRecipesData, isLoading: externalLoading, refetch: refetchExternal } = useQuery<{ recipes: ExternalRecipe[] }>({
    queryKey: ["/api/external-recipes"],
  });
  
  const externalRecipes = externalRecipesData?.recipes || [];

  // Mutation for creating a new recipe
  const createRecipeMutation = useMutation({
    mutationFn: async (newRecipe: { title: string; ingredients: string[]; steps: string[] }) => {
      const response = await fetch(apiUrl("/api/recipes"), {
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
    onSuccess: async (newRecipe: Recipe) => {
      // Invalidate and refetch recipes after creating a new one
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      
      // Check if we should auto-add the recipe to a trip
      // Use window.location.search to get the current query string reliably
      const searchParams = new URLSearchParams(window.location.search);
      const tripIdToAdd = searchParams.get('addToTrip');
      
      if (tripIdToAdd && newRecipe.id) {
        try {
          // Add the newly created recipe to the trip
          // apiRequest returns parsed JSON and throws on non-2xx responses
          await apiRequest("POST", `/api/trips/${tripIdToAdd}/meals`, { 
            recipeId: newRecipe.id 
          });
          
          // Success! Invalidate trip queries and show success message
          queryClient.invalidateQueries({ queryKey: ["/api/trips", tripIdToAdd, "meals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trips", tripIdToAdd] });
          
          toast({
            title: "Recipe created and added to trip!",
            description: `"${newRecipe.title}" has been added to your meal plan.`,
          });
          
          // Navigate back to the trip
          navigate(`/trips/${tripIdToAdd}`, { replace: true });
        } catch (error: any) {
          // Show error toast but don't fail the whole operation
          toast({
            title: "Recipe created",
            description: "Recipe was created but couldn't be added to the trip. You can add it manually.",
            variant: "destructive",
          });
          
          // Clean up URL params
          navigate('/recipes', { replace: true });
        }
      } else {
        // No trip to add to, just clean up URL if needed
        const cleanupParams = new URLSearchParams(window.location.search);
        if (cleanupParams.get('createNew')) {
          navigate('/recipes', { replace: true });
        }
      }
    },
  });

  const handleCreateRecipe = (newRecipe: { title: string; ingredients: string[]; steps: string[] }) => {
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
  // Also filters out blog posts that aren't actual recipes
  const filteredExternalRecipes = useMemo(() => {
    // Phrases we never want to show (case-insensitive, partial match)
    const blockedPhrases = [
      "camping food: easy meal planning",
      "campfire recipes & must-have cooking gear",
      "cozy winter camping meals to keep you warm",
      "50 non-perishable dry snacks for camping",
      "best canned food for camping",
      "easy no-chill meal ideas",
      "25 delicious and easy sides for camping",
      "23 easy griddle recipes for camping",
      "22 must-try skillet meals for camping",
      "25 easy camping meals for kids",
      "25 easy crock pot camping meals",
      "outdoor cooking for beginners",
    ];

    // Filter using a contains + lowercase match
    const cleanedExternalRecipes = externalRecipes.filter((r) => {
      const title = (r?.title || "").toLowerCase();

      // If any blocked phrase is inside the title, remove it
      const isBlocked = blockedPhrases.some((phrase) => title.includes(phrase));

      return !isBlocked;
    });

    // Then apply search filter if there's a query
    if (!searchQuery.trim()) return cleanedExternalRecipes;
    
    const query = searchQuery.toLowerCase();
    return cleanedExternalRecipes.filter(recipe =>
      recipe.title.toLowerCase().includes(query)
    );
  }, [externalRecipes, searchQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Loading recipes...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12 space-y-10">
        {/* Trip Context Banner */}
        {tripContext && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Adding meals to</p>
              <h3 className="font-semibold text-lg">{tripContext.tripName}</h3>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Clear query params by navigating without them
                navigate(`/trips/${tripContext.tripId}`, { replace: true });
              }}
              data-testid="button-back-to-trip"
            >
              Back to Trip
            </Button>
          </div>
        )}
        
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
                  fromTripId={tripContext?.tripId}
                  fromTripName={tripContext?.tripName}
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
              <Button
                onClick={() => refetchExternal()}
                variant="outline"
                size="sm"
                disabled={externalLoading}
                data-testid="button-refresh-external-recipes"
              >
                {externalLoading ? "Loading..." : "Refresh Recipes"}
              </Button>
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
                  content={recipe.content}
                  onViewExternal={() => setViewingExternalRecipeId(recipe.id)}
                  fromTripId={tripContext?.tripId}
                  fromTripName={tripContext?.tripName}
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
