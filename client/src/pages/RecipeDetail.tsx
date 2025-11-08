import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, Printer, ChefHat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import Header from "@/components/Header";

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

export default function RecipeDetail() {
  const params = useParams();
  const recipeId = parseInt(params.id || "1");
  
  // TODO: Remove mock data - use React Query to fetch from API
  const recipe = mockRecipes.find(r => r.id === recipeId) || mockRecipes[0];
  
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
                Created {formatDistanceToNow(recipe.createdAt, { addSuffix: true })}
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
