import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import RecipeCard from "@/components/RecipeCard";
import EmptyState from "@/components/EmptyState";
import { Search } from "lucide-react";
import type { Recipe } from "@shared/schema";

export default function SearchResults() {
  // Get query parameter from URL
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get('q') || '';

  // Fetch search results from the API
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query.trim()) {
        return [];
      }
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }
      return response.json();
    },
    enabled: !!query.trim(), // Only run query if there's a search term
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="text-center text-muted-foreground">Searching...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto px-6 md:px-10 py-12 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground" data-testid="text-search-title">
              Search Results
            </h1>
          </div>
          <p className="text-muted-foreground" data-testid="text-search-query">
            {recipes.length === 0 ? (
              `No recipes found for "${query}"`
            ) : (
              `Found ${recipes.length} recipe${recipes.length !== 1 ? 's' : ''} for "${query}"`
            )}
          </p>
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            message={`No recipes match "${query}". Try a different search term.`}
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
