import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import RecipeCard from "@/components/RecipeCard";
import RecipeForm from "@/components/RecipeForm";
import EmptyState from "@/components/EmptyState";
import Header from "@/components/Header";
import type { Recipe } from "@shared/schema";

export default function Home() {
  // Fetch all recipes from the API
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
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
          <h1 className="text-5xl font-serif font-bold text-foreground" data-testid="text-page-title">
            My Camp Recipes
          </h1>
          <p className="text-muted-foreground" data-testid="text-recipe-count">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in your collection
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <RecipeForm onSubmit={handleCreateRecipe} />
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            message="No recipes yet. Create your first camping recipe!"
            actionLabel="Get Started"
            onAction={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                ingredients={recipe.ingredients}
                createdAt={new Date(recipe.createdAt)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
