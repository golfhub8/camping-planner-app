import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PersonalGroceryItem {
  id: number;
  displayName: string;
  amounts: string[];
  recipeIds: number[];
  recipeTitles: string[];
}

export default function MyGroceryList() {
  const { toast } = useToast();
  const [showClearDialog, setShowClearDialog] = useState(false);

  const { data: groceryItems, isLoading } = useQuery<PersonalGroceryItem[]>({
    queryKey: ['/api/grocery/my-list'],
  });

  const clearListMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/grocery/my-list');
    },
    onSuccess: () => {
      setShowClearDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/grocery/my-list'] });
      toast({
        title: "List Cleared",
        description: "Your grocery list has been cleared.",
      });
    },
    onError: () => {
      setShowClearDialog(false);
      toast({
        title: "Error",
        description: "Failed to clear grocery list.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Grocery List</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const itemCount = groceryItems?.length || 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">My Grocery List</h1>
          <p className="text-muted-foreground" data-testid="text-item-count">
            {itemCount === 0 
              ? "No items yet. Add ingredients from your recipes!" 
              : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
            }
          </p>
        </div>
        {itemCount > 0 && (
          <Button
            variant="destructive"
            onClick={() => setShowClearDialog(true)}
            data-testid="button-clear-list"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear List
          </Button>
        )}
      </div>

      {itemCount === 0 ? (
        <Card data-testid="card-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Your grocery list is empty</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Visit your recipe pages and use the "Send to Grocery List" button to add ingredients here.
              Ingredients from multiple recipes will be automatically merged!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groceryItems?.map((item) => (
            <Card key={item.id} data-testid={`card-grocery-item-${item.id}`}>
              <CardHeader>
                <CardTitle className="text-lg" data-testid={`text-ingredient-${item.id}`}>
                  {item.displayName}
                </CardTitle>
                <CardDescription data-testid={`text-recipes-${item.id}`}>
                  From: {item.recipeTitles.map((title, idx) => 
                    `${title} (Recipe #${item.recipeIds[idx]})`
                  ).join(", ")}
                </CardDescription>
              </CardHeader>
              {item.amounts.length > 0 && (
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Amounts:</span>
                    <ul className="mt-1 space-y-1">
                      {item.amounts.map((amount, idx) => (
                        <li key={idx} data-testid={`text-amount-${item.id}-${idx}`}>
                          • {amount}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Grocery List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {itemCount} {itemCount === 1 ? 'item' : 'items'} from your grocery list. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearListMutation.mutate()}
              disabled={clearListMutation.isPending}
              data-testid="button-confirm-clear"
            >
              {clearListMutation.isPending ? "Clearing..." : "Clear List"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
