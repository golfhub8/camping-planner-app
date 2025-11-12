import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ChefHat, Eye, Share2, ExternalLink, Plus, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import TripSelector from "./TripSelector";
import IngredientPickerModal from "./IngredientPickerModal";

interface RecipeCardProps {
  id: number | string; // Can be number for internal recipes, or string (wp-ID) for external
  title: string;
  ingredients: string[];
  createdAt?: Date; // Optional for external recipes
  source?: "internal" | "external"; // Indicates if this is from database or WordPress
  url?: string; // For external recipes - link to full recipe
  onViewExternal?: () => void; // Handler for viewing external recipes in modal
}

export default function RecipeCard({ id, title, ingredients, createdAt, source = "internal", url, onViewExternal }: RecipeCardProps) {
  const { toast } = useToast();
  
  // State for the share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  
  // State for trip selector (external recipes)
  const [tripSelectorOpen, setTripSelectorOpen] = useState(false);
  
  // State for ingredient picker modal
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);

  const displayIngredients = ingredients.slice(0, 3);
  const hasMore = ingredients.length > 3;

  // Handle sharing a recipe with a collaborator
  // Sends the recipe details to the backend which generates a shareable message
  const handleShare = async () => {
    if (!shareEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    
    try {
      // Call the backend API to generate a shareable message
      const response = await apiRequest("POST", "/api/recipes/share", {
        recipeId: id,
        toEmail: shareEmail,
      });

      const data = await response.json();

      if (response.ok) {
        // Show the generated message that can be copied
        setShareMessage(data.message);
        
        toast({
          title: "Recipe Share Message Ready",
          description: "Copy the message below and send it to your friend!",
        });
      } else {
        throw new Error(data.error || "Failed to share recipe");
      }
    } catch (error: any) {
      toast({
        title: "Error Sharing Recipe",
        description: error.message || "Failed to share recipe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Copy message to clipboard
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard. You can now paste and send it!",
      });
      
      // Reset and close dialog after successful copy
      setTimeout(() => {
        setShareDialogOpen(false);
        setShareEmail("");
        setShareMessage("");
      }, 1000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  // Add recipe to trip mutation (for external recipes)
  const addToTripMutation = useMutation({
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
    onSuccess: () => {
      toast({
        title: "Recipe Added!",
        description: `"${title}" has been added to your trip.`,
      });
      setTripSelectorOpen(false);
      // Invalidate trip meals queries
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
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
    addToTripMutation.mutate(tripId);
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

        <CardFooter className="flex items-center justify-between gap-4 flex-wrap">
          {createdAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-created-${id}`}>
              <Calendar className="h-3.5 w-3.5" />
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </div>
          )}
          
          <div className="flex items-center gap-2 ml-auto">
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
            
            {/* Add to Trip button - only for external recipes */}
            {source === "external" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setTripSelectorOpen(true)}
                data-testid={`button-add-to-trip-${id}`}
              >
                <Plus className="h-4 w-4" />
                Add to Trip
              </Button>
            )}
            
            {/* Share button - works for both internal and external recipes */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShareDialogOpen(true)}
              data-testid={`button-share-recipe-${id}`}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            
            {/* View button - opens modal for external recipes or links to internal recipe page */}
            {source === "external" ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5"
                onClick={onViewExternal}
                data-testid={`button-view-recipe-${id}`}
              >
                <Eye className="h-4 w-4" />
                View Recipe
              </Button>
            ) : (
              <Link href={`/recipe/${id}`} data-testid={`link-view-recipe-${id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="h-4 w-4" />
                  View Recipe
                </Button>
              </Link>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Recipe with Collaborator</DialogTitle>
            <DialogDescription>
              Share "{title}" with a friend via email
            </DialogDescription>
          </DialogHeader>

          {!shareMessage ? (
            // Step 1: Enter email address
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="share-email">Email Address</Label>
                <Input
                  id="share-email"
                  type="email"
                  placeholder="friend@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  data-testid="input-share-email"
                />
              </div>
            </div>
          ) : (
            // Step 2: Show generated message to copy
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="share-message">Message to Send</Label>
                <Textarea
                  id="share-message"
                  value={shareMessage}
                  readOnly
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="textarea-share-message"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Copy this message and send it to your friend manually, or we can add automatic email sending in the future!
              </p>
            </div>
          )}

          <DialogFooter>
            {!shareMessage ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShareDialogOpen(false);
                    setShareEmail("");
                  }}
                  data-testid="button-cancel-share"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={isSharing}
                  data-testid="button-generate-message"
                >
                  {isSharing ? "Generating..." : "Generate Message"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShareDialogOpen(false);
                    setShareEmail("");
                    setShareMessage("");
                  }}
                  data-testid="button-close-share"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopyMessage}
                  data-testid="button-copy-message"
                >
                  Copy & Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trip Selector Dialog - for adding external recipes to trips */}
      <TripSelector
        open={tripSelectorOpen}
        onOpenChange={setTripSelectorOpen}
        onSelectTrip={handleSelectTrip}
        isLoading={addToTripMutation.isPending}
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
    </>
  );
}
