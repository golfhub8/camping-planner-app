import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Check, Tent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GroceryItem, GroceryCategory } from "@shared/schema";

// Page for sharing the grocery list
// Displays a clean, copyable list of needed items only
export default function GroceryShare() {
  const [, setLocation] = useLocation();
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Load items from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("groceryItems");
    if (stored) {
      setGroceryItems(JSON.parse(stored));
    }
  }, []);

  // Group items by category
  const groupedItems: Record<GroceryCategory, GroceryItem[]> = {
    "Produce": [],
    "Dairy": [],
    "Meat": [],
    "Pantry": [],
  };

  groceryItems.forEach(item => {
    groupedItems[item.category].push(item);
  });

  // Generate plain text list for copying
  function generatePlainText(): string {
    let text = "THE CAMPING PLANNER - GROCERY LIST\n\n";
    
    (Object.keys(groupedItems) as GroceryCategory[]).forEach(category => {
      const items = groupedItems[category];
      if (items.length > 0) {
        text += `${category.toUpperCase()}\n`;
        items.forEach(item => {
          text += `  • ${item.name}\n`;
        });
        text += "\n";
      }
    });

    return text;
  }

  // Copy list to clipboard
  async function handleCopyToClipboard() {
    const text = generatePlainText();
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied to clipboard!",
        description: "You can now paste this list into a text message or email.",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying the text manually.",
        variant: "destructive",
      });
    }
  }

  if (groceryItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">No Items to Share</h2>
            <p className="text-muted-foreground mb-6">
              All items are checked off, or you haven't created a grocery list yet.
            </p>
            <Button onClick={() => setLocation("/grocery")} data-testid="button-create-list">
              Create Grocery List
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-4xl">
      {/* Header Section */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Grocery List
        </Button>
        <h1 className="text-4xl font-bold mb-2">Share Your List</h1>
        <p className="text-lg text-muted-foreground">
          Copy this list to share with family or send to your phone
        </p>
      </div>

      {/* Copyable List Display */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Shopping List ({groceryItems.length} items)</span>
            <Button
              onClick={handleCopyToClipboard}
              variant="outline"
              size="sm"
              data-testid="button-copy"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-6 rounded-md font-mono text-sm whitespace-pre-wrap" data-testid="text-share-list">
            {generatePlainText()}
          </div>
        </CardContent>
      </Card>

      {/* Categorized View */}
      <div className="space-y-4 mb-8">
        <h2 className="text-2xl font-bold">Items by Category</h2>
        {(Object.keys(groupedItems) as GroceryCategory[]).map(category => {
          const items = groupedItems[category];
          if (items.length === 0) return null;

          return (
            <Card key={category} data-testid={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {items.map((item, index) => (
                    <li key={index} className="flex items-center gap-2" data-testid={`item-${index}`}>
                      <span className="text-primary">•</span>
                      <span>{item.name}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-home"
        >
          Back to Recipes
        </Button>
        <Button
          onClick={() => window.history.back()}
          data-testid="button-back-to-list"
        >
          Back to Grocery List
        </Button>
      </div>
      </main>
    </div>
  );
}
