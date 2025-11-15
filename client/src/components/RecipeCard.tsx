import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ChefHat, Eye, Share2, ExternalLink, Plus, ShoppingCart, Save, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import TripSelector from "./TripSelector";
import IngredientPickerModal from "./IngredientPickerModal";
import { SaveRecipeModal } from "./SaveRecipeModal";

interface RecipeCardProps {
  id: number | string; // Can be number for internal recipes, or string (wp-ID) for external
  title: string;
  ingredients: string[];
  createdAt?: Date; // Optional for external recipes
  source?: "internal" | "external"; // Indicates if this is from database or WordPress
  url?: string; // For external recipes - link to full recipe
  content?: string; // For external recipes - recipe instructions/content
  onViewExternal?: () => void; // Handler for viewing external recipes in modal
  fromTripId?: number; // Trip context for direct add
  fromTripName?: string; // Trip name for messaging
}

export default function RecipeCard({ id, title, ingredients, createdAt, source = "internal", url, content, onViewExternal, fromTripId, fromTripName }: RecipeCardProps) {
  const { toast } = useToast();
  
  // State for the share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  
  // State for trip selector (external recipes)
  const [tripSelectorOpen, setTripSelectorOpen] = useState(false);
  
  // State for ingredient picker modal
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);
  
  // State for save recipe modal (external recipes)
  const [saveRecipeModalOpen, setSaveRecipeModalOpen] = useState(false);
  
  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const displayIngredients = ingredients.slice(0, 3);
  const hasMore = ingredients.length > 3;

  // Generate shareable link for recipe
  const handleGenerateLink = async (regenerate = false) => {
    // Only works for internal recipes
    if (source === "external") {
      toast({
        title: "Cannot Share External Recipes",
        description: "You can only share recipes from your collection",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingLink(true);
    
    try {
      const queryParam = regenerate ? '?regenerate=true' : '';
      const response = await apiRequest("POST", `/api/recipes/${id}/share${queryParam}`);
      const data = await response.json();

      if (response.ok) {
        setShareUrl(data.shareUrl);
        toast({
          title: "Share Link Ready!",
          description: "Anyone with this link can view and save your recipe",
        });
      } else {
        throw new Error(data.error || "Failed to generate share link");
      }
    } catch (error: any) {
      toast({
        title: "Error Generating Link",
        description: error.message || "Failed to generate share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Share link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  // Open share dialog and generate link automatically
  const handleShareClick = () => {
    setShareDialogOpen(true);
    if (!shareUrl && source === "internal") {
      handleGenerateLink(false);
    }
  };

  // Add internal recipe to trip mutation
  const addInternalToTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      // Ensure id is a number for internal recipes
      if (typeof id !== 'number') {
        throw new Error("Invalid recipe ID for internal recipe");
      }
      const response = await apiRequest("POST", `/api/trips/${tripId}/meals`, {
        recipeId: id,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add recipe to trip");
      }
      return response.json();
    },
    onSuccess: (_, tripId) => {
      const tripName = fromTripName || "trip";
      toast({
        title: "Meal Added!",
        description: `"${title}" has been added to ${tripName}.`,
      });
      // Invalidate trip queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add recipe to trip",
        variant: "destructive",
      });
    },
  });

  // Add external recipe to trip mutation
  const addExternalToTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      const response = await apiRequest("POST", `/api/trips/${tripId}/meals`, {
        isExternal: true,
        externalRecipeId: String(id),
        title,
        sourceUrl: url,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add recipe to trip");
      }
      return response.json();
    },
    onSuccess: (_, tripId) => {
      const tripName = fromTripName || "trip";
      toast({
        title: "Recipe Added!",
        description: `"${title}" has been added to ${tripName}.`,
      });
      setTripSelectorOpen(false);
      // Invalidate trip queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "meals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add recipe to trip",
        variant: "destructive",
      });
    },
  });

  const handleSelectTrip = (tripId: number) => {
    if (source === "external") {
      addExternalToTripMutation.mutate(tripId);
    } else {
      addInternalToTripMutation.mutate(tripId);
    }
  };

  // Combined loading state for any add-to-trip operation
  const isAddingToTrip = addInternalToTripMutation.isPending || addExternalToTripMutation.isPending;

  const handleAddToTrip = () => {
    if (isAddingToTrip) return; // Prevent double-click
    
    if (fromTripId) {
      // Direct add to the trip from context
      if (source === "external") {
        addExternalToTripMutation.mutate(fromTripId);
      } else {
        addInternalToTripMutation.mutate(fromTripId);
      }
    } else {
      // Show trip selector
      setTripSelectorOpen(true);
    }
  };

  // Delete recipe mutation - only for internal recipes
  const deleteRecipeMutation = useMutation({
    mutationFn: async () => {
      if (typeof id !== 'number') {
        throw new Error("Cannot delete external recipes");
      }
      const response = await apiRequest("DELETE", `/api/recipes/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete recipe");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recipe Removed",
        description: `"${title}" has been removed from your collection.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recipe",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteRecipeMutation.mutate();
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className="hover-elevate transition-all" data-testid={`card-recipe-${id}`}>
        <CardHeader className="space-y-3">
          <CardTitle className="line-clamp-2 text-xl font-bold" data-testid={`text-recipe-title-${id}`}>
            {title}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {ingredients.length > 0 ? (
              <Badge variant="default" className="w-fit gap-1" data-testid={`badge-ingredient-count-${id}`}>
                <ChefHat className="h-3 w-3" />
                {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit" data-testid={`badge-external-${id}`}>
                External Recipe
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Show ingredients if available */}
          {ingredients.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {displayIngredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-start gap-2" data-testid={`text-ingredient-${id}-${idx}`}>
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                  <span className="line-clamp-1">{ingredient}</span>
                </li>
              ))}
              {hasMore && (
                <li className="text-xs text-muted-foreground pl-3">
                  +{ingredients.length - 3} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              View full recipe for ingredients
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-center justify-center gap-3">
          {/* View Recipe button - first row, larger */}
          {source === "external" ? (
            <Button 
              variant="outline" 
              size="default" 
              className="gap-1.5 w-full"
              onClick={onViewExternal}
              data-testid={`button-view-recipe-${id}`}
            >
              <Eye className="h-4 w-4" />
              View Recipe
            </Button>
          ) : (
            <Link href={`/recipe/${id}`} data-testid={`link-view-recipe-${id}`} className="w-full">
              <Button variant="outline" size="default" className="gap-1.5 w-full">
                <Eye className="h-4 w-4" />
                View Recipe
              </Button>
            </Link>
          )}
          
          {/* Second row - other action buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-center w-full">
            {/* Save to My Recipes button - only for external recipes */}
            {source === "external" && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 flex-1"
                onClick={() => setSaveRecipeModalOpen(true)}
                data-testid={`button-save-recipe-${id}`}
              >
                <Save className="h-4 w-4" />
                Save Recipe
              </Button>
            )}
            
            {/* Add to Trip button - show when trip context exists OR for external recipes */}
            {(fromTripId || source === "external") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1"
                onClick={handleAddToTrip}
                disabled={isAddingToTrip}
                data-testid={`button-add-to-trip-${id}`}
              >
                <Plus className="h-4 w-4" />
                {fromTripId ? `Add to ${fromTripName}` : "Add to Trip"}
              </Button>
            )}
            
            {/* Add to Grocery button - only if ingredients available */}
            {ingredients.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => setIngredientPickerOpen(true)}
                data-testid={`button-add-to-grocery-${id}`}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Grocery
              </Button>
            )}
            
            {/* Share button - only for internal recipes */}
            {source === "internal" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleShareClick}
                data-testid={`button-share-recipe-${id}`}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
            
            {/* Delete button - only for internal recipes */}
            {source === "internal" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleDeleteClick}
                disabled={deleteRecipeMutation.isPending}
                data-testid={`button-delete-recipe-${id}`}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          
          {createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-created-${id}`}>
              <Calendar className="h-3.5 w-3.5" />
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={(open) => {
        setShareDialogOpen(open);
        if (!open) {
          // Reset state when closing
          setShareUrl("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Recipe</DialogTitle>
            <DialogDescription>
              Anyone with this link can view and save "{title}" to their collection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isGeneratingLink ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Generating share link...</p>
              </div>
            ) : shareUrl ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="share-url">Share Link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="share-url"
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-share-url"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      data-testid="button-copy-link"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this link with anyone! They can view the recipe and save it to their own collection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateLink(true)}
                  disabled={isGeneratingLink}
                  className="w-full"
                  data-testid="button-regenerate-link"
                >
                  Regenerate Link (Revokes Old Link)
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Button
                  onClick={() => handleGenerateLink(false)}
                  disabled={isGeneratingLink}
                  data-testid="button-generate-link"
                >
                  Generate Share Link
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
              data-testid="button-close-share"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trip Selector Dialog - for adding recipes to trips */}
      <TripSelector
        open={tripSelectorOpen}
        onOpenChange={setTripSelectorOpen}
        onSelectTrip={handleSelectTrip}
        isLoading={isAddingToTrip}
      />
      
      {/* Ingredient Picker Modal - for adding ingredients to grocery list */}
      {ingredients.length > 0 && (
        <IngredientPickerModal
          open={ingredientPickerOpen}
          onOpenChange={setIngredientPickerOpen}
          recipeId={typeof id === 'number' ? id : 0}
          recipeTitle={title}
          ingredients={ingredients}
        />
      )}
      
      {/* Save Recipe Modal - for saving external recipes to My Recipes */}
      {source === "external" && (
        <SaveRecipeModal
          open={saveRecipeModalOpen}
          onOpenChange={setSaveRecipeModalOpen}
          externalRecipe={{
            title,
            sourceUrl: url,
            ingredients,
            content,
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-recipe">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              "{title}" will be moved to your archive. You can always restore it later if you change your mind. This won't affect any trips that already use this recipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Keep Recipe</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              data-testid="button-confirm-delete"
            >
              Remove from Collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
