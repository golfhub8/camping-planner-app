import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Share2, ArrowLeft, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { GroceryItem, GroceryCategory } from "@shared/schema";

// Category icon and color mapping
const categoryConfig: Record<GroceryCategory, { icon: string; color: string }> = {
  "Produce": { icon: "🥕", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  "Dairy": { icon: "🥛", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  "Meat": { icon: "🥩", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  "Pantry": { icon: "🥫", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  "Camping Gear": { icon: "⛺", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
};

// Page for displaying the generated grocery list
// Shows items grouped by category with checkboxes to mark items as "already have"
export default function GroceryList() {
  const [location, setLocation] = useLocation();
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false);

  // Parse recipe IDs from URL query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const recipeIds = searchParams.getAll("recipeIds").map(id => parseInt(id));

  // Generate grocery list from selected recipes
  const generateListMutation = useMutation({
    mutationFn: async (recipeIds: number[]) => {
      const response = await apiRequest("POST", "/api/grocery/generate", { recipeIds });
      const data = await response.json();
      return data as { items: GroceryItem[] };
    },
    onSuccess: (data) => {
      setGroceryItems(data.items);
    },
  });

  // Generate list on component mount
  useEffect(() => {
    if (recipeIds.length > 0) {
      generateListMutation.mutate(recipeIds);
    }
  }, []);

  // Toggle item checked state
  function toggleItem(index: number) {
    setGroceryItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  }

  // Navigate to share page with unchecked items
  function handleShare() {
    const neededItems = groceryItems.filter(item => !item.checked);
    // Store items in sessionStorage to pass to share page
    sessionStorage.setItem("groceryItems", JSON.stringify(neededItems));
    setLocation("/grocery/share");
  }

  // Group items by category
  const groupedItems: Record<GroceryCategory, GroceryItem[]> = {
    "Produce": [],
    "Dairy": [],
    "Meat": [],
    "Pantry": [],
    "Camping Gear": [],
  };

  groceryItems.forEach(item => {
    groupedItems[item.category].push(item);
  });

  // Filter items based on showOnlyNeeded toggle
  const displayedItems = showOnlyNeeded 
    ? groceryItems.filter(item => !item.checked)
    : groceryItems;

  if (recipeIds.length === 0) {
    return (
      <div className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Recipes Selected</h2>
          <p className="text-muted-foreground mb-6">
            Please select some recipes first to generate a grocery list.
          </p>
          <Button onClick={() => setLocation("/grocery")} data-testid="button-select-recipes">
            Select Recipes
          </Button>
        </div>
      </div>
    );
  }

  if (generateListMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const neededCount = groceryItems.filter(item => !item.checked).length;

  return (
    <div className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
      {/* Header Section */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/grocery")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Recipe Selection
        </Button>
        <h1 className="text-4xl font-bold mb-2">Your Grocery List</h1>
        <p className="text-lg text-muted-foreground">
          Check off items you already have at home
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="show-needed"
                checked={showOnlyNeeded}
                onCheckedChange={setShowOnlyNeeded}
                data-testid="switch-show-needed"
              />
              <Label htmlFor="show-needed" className="cursor-pointer">
                Show Only Needed Items
              </Label>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" data-testid="badge-total-count">
                {groceryItems.length} total items
              </Badge>
              <Badge className="bg-primary" data-testid="badge-needed-count">
                {neededCount} needed
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grocery Items by Category */}
      <div className="space-y-6">
        {(Object.keys(groupedItems) as GroceryCategory[]).map(category => {
          const categoryItems = groupedItems[category];
          const visibleItems = showOnlyNeeded 
            ? categoryItems.filter(item => !item.checked)
            : categoryItems;

          if (visibleItems.length === 0) return null;

          const config = categoryConfig[category];

          return (
            <Card key={category} data-testid={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{config.icon}</span>
                  <span>{category}</span>
                  <Badge variant="outline" className="ml-2">
                    {visibleItems.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryItems.map((item, index) => {
                  const globalIndex = groceryItems.indexOf(item);
                  if (showOnlyNeeded && item.checked) return null;

                  return (
                    <div
                      key={globalIndex}
                      className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                      data-testid={`item-${globalIndex}`}
                    >
                      <Checkbox
                        id={`item-${globalIndex}`}
                        checked={item.checked}
                        onCheckedChange={() => toggleItem(globalIndex)}
                        data-testid={`checkbox-item-${globalIndex}`}
                      />
                      <label
                        htmlFor={`item-${globalIndex}`}
                        className={`flex-1 cursor-pointer ${
                          item.checked ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.name}
                      </label>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end mt-8">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-home"
        >
          Back to Recipes
        </Button>
        <Button
          onClick={handleShare}
          disabled={neededCount === 0}
          data-testid="button-share"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share List ({neededCount} items)
        </Button>
      </div>
    </div>
  );
}
