import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { scrapeRecipe, type ScrapedRecipe } from "@/lib/recipeScraper";

const saveRecipeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ingredientsText: z.string().min(1, "Ingredients are required"),
  stepsText: z.string().min(1, "Instructions are required"),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type SaveRecipeForm = z.infer<typeof saveRecipeSchema>;

interface SaveRecipeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalRecipe: {
    title: string;
    sourceUrl?: string;
    ingredients?: string[];
    content?: string;
  };
}

export function SaveRecipeModal({ open, onOpenChange, externalRecipe }: SaveRecipeModalProps) {
  const { toast } = useToast();
  const [isParsing, setIsParsing] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedRecipe | null>(null);
  const [scrapeError, setScrapError] = useState<string>("");

  const form = useForm<SaveRecipeForm>({
    resolver: zodResolver(saveRecipeSchema),
    defaultValues: {
      title: externalRecipe.title,
      sourceUrl: externalRecipe.sourceUrl || "",
      ingredientsText: externalRecipe.ingredients?.join("\n") || "",
      stepsText: "",
      imageUrl: "",
    },
  });

  // Auto-scrape when modal opens with a sourceUrl
  useEffect(() => {
    if (open && externalRecipe.sourceUrl) {
      handleAutoScrape();
    }
  }, [open, externalRecipe.sourceUrl]);

  async function handleAutoScrape() {
    if (!externalRecipe.sourceUrl) return;
    
    setIsParsing(true);
    setScrapError("");
    
    try {
      // Call server-side parse endpoint for consistent, robust parsing
      const response = await apiRequest("POST", "/api/recipes/parse", {
        url: externalRecipe.sourceUrl,
      });
      
      const scraped = await response.json();
      
      setScrapedData({
        ...scraped,
        sourceUrl: externalRecipe.sourceUrl,
      });
      
      // Update form with scraped data
      if (scraped.title) {
        form.setValue("title", scraped.title);
      }
      if (scraped.ingredients && scraped.ingredients.length > 0) {
        form.setValue("ingredientsText", scraped.ingredients.join("\n"));
      }
      if (scraped.steps && scraped.steps.length > 0) {
        form.setValue("stepsText", scraped.steps.join("\n\n"));
      }
      if (scraped.imageUrl) {
        form.setValue("imageUrl", scraped.imageUrl);
      }
      
      // Show success or partial success message
      if (scraped.title && scraped.ingredients && scraped.ingredients.length > 0) {
        toast({
          title: "Recipe parsed successfully",
          description: `Found ${scraped.ingredients.length} ingredients and ${scraped.steps?.length || 0} steps`,
        });
      } else {
        // Parsing returned empty data - show error
        throw new Error("Could not extract recipe data from URL");
      }
    } catch (error) {
      console.error("Auto-scrape failed:", error);
      setScrapError(error instanceof Error ? error.message : "Failed to parse recipe");
      
      // Fall back to provided data
      if (externalRecipe.ingredients) {
        form.setValue("ingredientsText", externalRecipe.ingredients.join("\n"));
      }
    } finally {
      setIsParsing(false);
    }
  }

  const saveRecipeMutation = useMutation({
    mutationFn: async (data: SaveRecipeForm) => {
      // Parse ingredients from textarea (one per line)
      const ingredients = data.ingredientsText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Parse steps from textarea (split by double newlines or single newlines)
      const steps = data.stepsText
        .split(/\n\n+/)
        .map(step => step.trim().replace(/\n/g, " "))
        .filter(step => step.length > 0);

      const response = await apiRequest("POST", "/api/recipes", {
        title: data.title,
        ingredients,
        steps,
        imageUrl: data.imageUrl || undefined,
        sourceUrl: data.sourceUrl || undefined,
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Recipe saved",
        description: "The recipe has been added to My Recipes for offline use",
      });
      onOpenChange(false);
      form.reset();
      setScrapedData(null);
      setScrapError("");
    },
    onError: (error) => {
      toast({
        title: "Failed to save recipe",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  function handleSmartParse() {
    setIsParsing(true);
    
    // Get current ingredients text
    const ingredientsText = form.getValues("ingredientsText");
    
    // Smart parse: clean up common formatting issues
    const parsed = ingredientsText
      .split(/\n+/) // Split on one or more newlines
      .map(line => {
        // Remove bullet points, dashes, asterisks at the start
        let cleaned = line.trim().replace(/^[-•*]\s*/, "");
        
        // Remove extra whitespace
        cleaned = cleaned.replace(/\s+/g, " ");
        
        // Try to extract quantity and unit
        // Pattern: "2 cups flour" or "1 lb chicken" or "3 eggs"
        const quantityMatch = cleaned.match(/^(\d+\.?\d*)\s+(\w+)\s+(.+)$/);
        if (quantityMatch) {
          const [, qty, unit, ingredient] = quantityMatch;
          // Format as: "qty unit ingredient"
          return `${qty} ${unit} ${ingredient}`;
        }
        
        return cleaned;
      })
      .filter(line => line.length > 0);
    
    // Update the form field
    form.setValue("ingredientsText", parsed.join("\n"));
    
    setTimeout(() => {
      setIsParsing(false);
      toast({
        title: "Ingredients parsed",
        description: `Formatted ${parsed.length} ingredient${parsed.length !== 1 ? 's' : ''}`,
      });
    }, 300);
  }

  const ingredientCount = form.watch("ingredientsText").split("\n").filter(Boolean).length;
  const stepCount = form.watch("stepsText").split(/\n\n+/).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Recipe to My Recipes</DialogTitle>
          <DialogDescription>
            Save this external recipe to your collection for offline use in trips and grocery lists
          </DialogDescription>
        </DialogHeader>

        {isParsing && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Parsing recipe data from source URL...
            </AlertDescription>
          </Alert>
        )}

        {scrapeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{scrapeError}. You can still fill in the recipe details manually below.</span>
              {externalRecipe.sourceUrl && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAutoScrape}
                  disabled={isParsing}
                  data-testid="button-reparse"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {scrapedData && !scrapeError && (
          <Alert>
            <CheckCircle className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center gap-2">
              <span>Recipe parsed successfully</span>
              <Badge variant="outline">{scrapedData.ingredients.length} ingredients</Badge>
              <Badge variant="outline">{scrapedData.steps.length} steps</Badge>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => saveRecipeMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Campfire Chili" data-testid="input-recipe-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source URL</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." data-testid="input-source-url" readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ingredientsText"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Ingredients (one per line)</FormLabel>
                    <Badge variant="secondary">{ingredientCount} items</Badge>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="2 cups flour&#10;1 cup sugar&#10;3 eggs"
                      rows={8}
                      className="font-mono text-sm"
                      data-testid="textarea-ingredients"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stepsText"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Instructions (separate steps with blank lines)</FormLabel>
                    <Badge variant="secondary">{stepCount} steps</Badge>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Heat oil in a large pot over medium heat.&#10;&#10;Add onions and cook until soft, about 5 minutes.&#10;&#10;Add remaining ingredients..."
                      rows={10}
                      data-testid="textarea-steps"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." data-testid="input-image-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveRecipeMutation.isPending}
                className="gap-2"
                data-testid="button-save-recipe"
              >
                {saveRecipeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Recipe
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
