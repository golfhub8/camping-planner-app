// Public page for viewing shared grocery lists
// No authentication required - accessible via shareable link
// URL format: /shared/:token

import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShoppingCart } from "lucide-react";
import type { GroceryItem, GroceryCategory, SharedGroceryList } from "@shared/schema";

// Grocery categories for grouping
const groceryCategories: GroceryCategory[] = ["Produce", "Dairy", "Meat", "Pantry", "Camping Gear"];

export default function SharedGroceryView() {
  const [, params] = useRoute("/shared/:token");
  const [sharedList, setSharedList] = useState<SharedGroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    // Fetch the shared grocery list
    fetch(`/api/grocery/shared/${params.token}`)
      .then(res => {
        if (!res.ok) {
          throw new Error("Shared list not found or expired");
        }
        return res.json();
      })
      .then((data: SharedGroceryList) => {
        setSharedList(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [params?.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (error || !sharedList) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Link Not Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error || "This grocery list doesn't exist or has expired."}
            </p>
            <p className="text-sm text-muted-foreground">
              Please check the link and try again, or ask the person who shared it to send a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse items from JSONB
  const items = sharedList.items as unknown as GroceryItem[];

  // Group items by category
  const groupedItems: Record<GroceryCategory, GroceryItem[]> = {
    "Produce": [],
    "Dairy": [],
    "Meat": [],
    "Pantry": [],
    "Camping Gear": [],
  };

  items.forEach(item => {
    groupedItems[item.category].push(item);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">The Camping Planner</h1>
              <p className="text-sm text-muted-foreground">Shared Grocery List</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
        {/* Trip Info */}
        {sharedList.tripName && (
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" data-testid="text-trip-name">
              {sharedList.tripName}
            </h2>
            <p className="text-lg text-muted-foreground">
              Grocery list for your camping trip
            </p>
          </div>
        )}

        {/* Summary Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Shopping List</span>
              <span className="text-sm font-normal text-muted-foreground">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This list has been shared with you. Print or save it to your phone for easy shopping!
            </p>
          </CardContent>
        </Card>

        {/* Items by Category */}
        <div className="space-y-6">
          {groceryCategories.map(category => {
            const categoryItems = groupedItems[category];
            if (categoryItems.length === 0) return null;

            return (
              <Card key={category} data-testid={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {categoryItems.map((item, index) => (
                      <li 
                        key={index} 
                        className="flex items-center gap-3 text-lg"
                        data-testid={`item-${index}`}
                      >
                        <div className="h-5 w-5 rounded border-2 border-muted-foreground flex-shrink-0" />
                        <span>{item.name}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by The Camping Planner
          </p>
          <Button
            variant="ghost"
            onClick={() => window.print()}
            className="mt-2"
            data-testid="button-print"
          >
            Print this list
          </Button>
        </div>
      </main>
    </div>
  );
}
