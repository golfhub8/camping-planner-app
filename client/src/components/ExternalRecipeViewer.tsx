import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Share2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExternalRecipeViewerProps {
  recipeId: string | null; // wp-12345 format, or null when closed
  onClose: () => void;
}

interface ExternalRecipe {
  id: string;
  title: string;
  contentHtml: string;
  ingredients: string[];
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
  const handleCopyIngredients = async () => {
    if (!recipe || recipe.ingredients.length === 0) {
      toast({
        title: "No Ingredients",
        description: "This recipe has no parsed ingredients to copy",
        variant: "destructive",
      });
      return;
    }

    // Format ingredients as a text list
    const ingredientsText = recipe.ingredients.map((ing, idx) => `${idx + 1}. ${ing}`).join("\n");

    try {
      await navigator.clipboard.writeText(ingredientsText);
      toast({
        title: "Copied!",
        description: `${recipe.ingredients.length} ingredients copied to clipboard`,
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
                {/* Ingredients Section */}
                {recipe.ingredients.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Ingredients</h3>
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
                    <ul className="space-y-2 bg-muted/50 rounded-lg p-4">
                      {recipe.ingredients.map((ingredient, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm"
                          data-testid={`text-external-ingredient-${idx}`}
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          <span>{ingredient}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recipe Content (HTML from WordPress) */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Recipe</h3>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: recipe.contentHtml }}
                    data-testid="text-external-recipe-content"
                  />
                </div>
              </div>

              {/* Fixed footer - always visible */}
              <DialogFooter className="flex items-center gap-2 sm:justify-between flex-wrap border-t pt-4">
                <div className="flex items-center gap-2 flex-wrap">
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
                      variant={recipe.ingredients.length === 0 ? "default" : "outline"}
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
    </>
  );
}
