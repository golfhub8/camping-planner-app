import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Share2, Loader2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import IngredientPickerModal from "./IngredientPickerModal";

interface ExternalRecipeViewerProps {
  recipeId: string | null; // wp-12345 format, or null when closed
  onClose: () => void;
}

interface IngredientChecklistItem {
  name: string;
  amountImperial?: string;
  amountMetric?: string;
  notes?: string;
}

interface ExternalRecipe {
  id: string;
  title: string;
  contentHtml: string;
  ingredientsChecklist: IngredientChecklistItem[];
  extraBullets: string[];
  url: string;
}

/**
 * ExternalRecipeViewer Component
 * 
 * Displays a WordPress recipe in a modal dialog with full content and extracted ingredients.
 * Features:
 * - Fetches recipe details from the backend WordPress API integration
 * - Shows full recipe HTML content (rendered with dangerouslySetInnerHTML)
 * - Displays parsed ingredients in a list format
 * - Copy ingredients functionality
 * - Share recipe with collaborator
 * - Link to view on original WordPress site
 */
export default function ExternalRecipeViewer({ recipeId, onClose }: ExternalRecipeViewerProps) {
  const { toast } = useToast();
  
  // Recipe data state
  const [recipe, setRecipe] = useState<ExternalRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  
  // Ingredient picker modal state
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);

  // Fetch recipe details when recipeId changes
  useEffect(() => {
    if (!recipeId) {
      setRecipe(null);
      setError(null);
      return;
    }

    const fetchRecipe = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch recipe details from the backend
        // Backend will call WordPress REST API: /wp-json/wp/v2/posts/:id
        const response = await fetch(`/api/recipes/external/${recipeId}`);

        if (!response.ok) {
          throw new Error("Recipe not found");
        }

        const data = await response.json();
        setRecipe(data);
      } catch (err: any) {
        setError(err.message || "Failed to load recipe");
        toast({
          title: "Error Loading Recipe",
          description: err.message || "Failed to load recipe from WordPress",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipe();
  }, [recipeId, toast]);

  // Copy ingredients to clipboard
  // Prioritizes the structured ingredients checklist, falls back to extra bullets
  const handleCopyIngredients = async () => {
    if (!recipe) return;

    let ingredientsText = "";
    let count = 0;

    // Prioritize the structured ingredients checklist
    if (recipe.ingredientsChecklist && recipe.ingredientsChecklist.length > 0) {
      ingredientsText = recipe.ingredientsChecklist.map((item, idx) => {
        let line = `${idx + 1}. ${item.name}`;
        if (item.amountImperial) {
          line = `${idx + 1}. ${item.amountImperial} ${item.name}`;
        }
        if (item.amountMetric) {
          line += ` (${item.amountMetric})`;
        }
        if (item.notes) {
          line += ` - ${item.notes}`;
        }
        return line;
      }).join("\n");
      count = recipe.ingredientsChecklist.length;
    } else if (recipe.extraBullets && recipe.extraBullets.length > 0) {
      // Fallback to extra bullets
      ingredientsText = recipe.extraBullets.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
      count = recipe.extraBullets.length;
    }

    if (!ingredientsText) {
      toast({
        title: "No Ingredients",
        description: "This recipe has no ingredients to copy",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(ingredientsText);
      toast({
        title: "Copied!",
        description: `${count} items copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard. Please copy manually.",
        variant: "destructive",
      });
    }
  };

  // Share recipe with collaborator
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
        recipeId: recipe?.id,
        toEmail: shareEmail,
      });

      const data = await response.json();

      if (response.ok) {
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

  // Copy share message to clipboard
  const handleCopyShareMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard. You can now paste and send it!",
      });

      // Reset and close share dialog
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

  // Handle dialog close
  const handleClose = () => {
    setShareDialogOpen(false);
    setShareEmail("");
    setShareMessage("");
    onClose();
  };
  
  // Convert ingredients checklist to string array for ingredient picker modal
  const getIngredientsAsStrings = (): string[] => {
    if (!recipe) return [];
    
    if (recipe.ingredientsChecklist && recipe.ingredientsChecklist.length > 0) {
      return recipe.ingredientsChecklist.map((item) => {
        let ingredientStr = item.name;
        if (item.amountImperial) {
          ingredientStr = `${item.amountImperial} ${item.name}`;
        }
        if (item.notes) {
          ingredientStr += ` (${item.notes})`;
        }
        return ingredientStr;
      });
    }
    
    // Fallback to extra bullets if no checklist
    return recipe.extraBullets || [];
  };

  return (
    <>
      {/* Main Recipe Viewer Dialog */}
      <Dialog open={!!recipeId} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            // Loading state
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={handleClose} data-testid="button-close-error">
                Close
              </Button>
            </div>
          ) : recipe ? (
            // Recipe content
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold pr-8" data-testid="text-external-recipe-title">
                  {recipe.title}
                </DialogTitle>
                <DialogDescription>
                  <Badge variant="secondary" className="w-fit mt-2">
                    From TheCampingPlanner.com
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto space-y-6 py-4">
                {/* Recipe Content (HTML from WordPress) - shown first */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Recipe</h3>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: recipe.contentHtml }}
                    data-testid="text-external-recipe-content"
                  />
                </div>

                {/* Ingredients Checklist Section (structured table data) */}
                {recipe.ingredientsChecklist && recipe.ingredientsChecklist.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Ingredients Checklist (printable)</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyIngredients}
                        className="gap-1.5"
                        data-testid="button-copy-ingredients"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Ingredients
                      </Button>
                    </div>
                    <div className="overflow-x-auto bg-muted/50 rounded-lg">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-semibold">Ingredient</th>
                            <th className="text-left p-3 font-semibold">Amount (Imperial)</th>
                            <th className="text-left p-3 font-semibold">Metric</th>
                            <th className="text-left p-3 font-semibold">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipe.ingredientsChecklist.map((item, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-border last:border-0"
                              data-testid={`row-ingredient-${idx}`}
                            >
                              <td className="p-3">{item.name}</td>
                              <td className="p-3 text-muted-foreground">{item.amountImperial || "—"}</td>
                              <td className="p-3 text-muted-foreground">{item.amountMetric || "—"}</td>
                              <td className="p-3 text-muted-foreground">{item.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Extra Bullets Section (related ideas/recipes) */}
                {recipe.extraBullets && recipe.extraBullets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-muted-foreground">
                      Related ideas from TheCampingPlanner.com
                    </h3>
                    <ul className="space-y-2 bg-muted/30 rounded-lg p-4">
                      {recipe.extraBullets.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                          data-testid={`text-extra-bullet-${idx}`}
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/50" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Fixed footer - always visible */}
              <DialogFooter className="flex items-center gap-2 sm:justify-between flex-wrap border-t pt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Add to Grocery button - only if ingredients available */}
                  {(recipe.ingredientsChecklist.length > 0 || recipe.extraBullets.length > 0) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIngredientPickerOpen(true)}
                      className="gap-1.5"
                      data-testid="button-add-to-grocery-external"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Add to Grocery
                    </Button>
                  )}
                  
                  {/* Share button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                    className="gap-1.5"
                    data-testid="button-share-external-recipe"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>

                  {/* Open on WordPress button - always show but highlight if no ingredients */}
                  <a
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-open-wordpress"
                  >
                    <Button
                      variant={(recipe.ingredientsChecklist.length === 0 && recipe.extraBullets.length === 0) ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open on TheCampingPlanner.com
                    </Button>
                  </a>
                </div>

                <Button onClick={handleClose} data-testid="button-close-external-recipe">
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Share Dialog (nested) */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Recipe with Collaborator</DialogTitle>
            <DialogDescription>
              Share "{recipe?.title}" with a friend via email
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
                  data-testid="input-share-external-email"
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
                  data-testid="textarea-share-external-message"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Copy this message and send it to your friend manually!
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
                  data-testid="button-cancel-external-share"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={isSharing}
                  data-testid="button-generate-external-message"
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
                  data-testid="button-close-external-share"
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopyShareMessage}
                  data-testid="button-copy-external-message"
                >
                  Copy & Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Ingredient Picker Modal - for adding ingredients to grocery list */}
      {recipe && (
        <IngredientPickerModal
          open={ingredientPickerOpen}
          onOpenChange={setIngredientPickerOpen}
          recipeId={0} // External recipes don't have numeric IDs
          recipeTitle={recipe.title}
          ingredients={getIngredientsAsStrings()}
        />
      )}
    </>
  );
}
