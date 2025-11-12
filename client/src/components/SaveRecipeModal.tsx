import { useState } from "react";
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
import { Loader2, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const saveRecipeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  ingredientsText: z.string().min(1, "Ingredients are required"),
  steps: z.string().min(1, "Instructions are required"),
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

  const form = useForm<SaveRecipeForm>({
    resolver: zodResolver(saveRecipeSchema),
    defaultValues: {
      title: externalRecipe.title,
      sourceUrl: externalRecipe.sourceUrl || "",
      ingredientsText: externalRecipe.ingredients?.join("\n") || "",
      steps: externalRecipe.content || "",
    },
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (data: SaveRecipeForm) => {
      // Parse ingredients from textarea (one per line)
      const ingredients = data.ingredientsText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const response = await apiRequest("POST", "/api/recipes", {
        title: data.title,
        ingredients,
        steps: data.steps,
        sourceUrl: data.sourceUrl || undefined,
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "Recipe saved",
        description: "The recipe has been added to My Recipes",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save recipe",
        description: error.message,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Recipe to My Recipes</DialogTitle>
          <DialogDescription>
            Save this external recipe to your collection so you can use it in trips and grocery lists
          </DialogDescription>
        </DialogHeader>

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
                  <FormLabel>Source URL (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." data-testid="input-source-url" />
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSmartParse}
                      disabled={isParsing}
                      className="gap-2"
                      data-testid="button-smart-parse"
                    >
                      {isParsing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Smart Parse
                    </Button>
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
              name="steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe how to prepare this recipe..."
                      rows={6}
                      data-testid="textarea-steps"
                    />
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
