import { useLocation } from "wouter";
import RecipeCard from "@/components/RecipeCard";
import EmptyState from "@/components/EmptyState";
import Header from "@/components/Header";
import { Search } from "lucide-react";

// TODO: Remove mock data - this will be fetched from the backend
const mockRecipes = [
  {
    id: 1,
    title: "Campfire Chili",
    ingredients: [
      "1 lb ground beef",
      "2 cans kidney beans",
      "1 can diced tomatoes",
      "1 onion, diced",
      "2 tbsp chili powder",
      "1 tsp cumin",
      "Salt and pepper to taste"
    ],
    steps: "1. Brown the ground beef in a pot over the campfire.\n2. Add diced onions and cook until soft.\n3. Add beans, tomatoes, and spices.\n4. Simmer for 30 minutes, stirring occasionally.\n5. Serve hot with cornbread.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  {
    id: 2,
    title: "Trail Mix Energy Bars",
    ingredients: [
      "2 cups rolled oats",
      "1 cup mixed nuts",
      "1/2 cup honey",
      "1/2 cup peanut butter",
      "1/2 cup dried cranberries",
      "1/4 cup chocolate chips"
    ],
    steps: "1. Mix oats, nuts, and cranberries in a bowl.\n2. Heat honey and peanut butter until smooth.\n3. Pour over dry ingredients and mix well.\n4. Press into a baking pan.\n5. Refrigerate for 2 hours before cutting into bars.",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },
  {
    id: 3,
    title: "Foil Packet Fish",
    ingredients: [
      "4 fish fillets",
      "2 lemons, sliced",
      "4 tbsp butter",
      "Fresh dill",
      "Garlic powder",
      "Salt and pepper"
    ],
    steps: "1. Place each fillet on a sheet of foil.\n2. Top with lemon slices, butter, and seasonings.\n3. Fold foil to create sealed packets.\n4. Place on campfire grill for 15-20 minutes.\n5. Open carefully and serve.",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }
];

export default function SearchResults() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const query = searchParams.get('q') || '';

  // TODO: Remove mock filtering - this will be done by the backend API
  const filteredRecipes = mockRecipes.filter(recipe =>
    recipe.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12 space-y-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Search className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-serif font-bold text-foreground" data-testid="text-search-title">
              Search Results
            </h1>
          </div>
          <p className="text-muted-foreground" data-testid="text-search-query">
            {filteredRecipes.length === 0 ? (
              `No recipes found for "${query}"`
            ) : (
              `Found ${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? 's' : ''} for "${query}"`
            )}
          </p>
        </div>

        {filteredRecipes.length === 0 ? (
          <EmptyState
            message={`No recipes match "${query}". Try a different search term.`}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                id={recipe.id}
                title={recipe.title}
                ingredients={recipe.ingredients}
                createdAt={recipe.createdAt}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
