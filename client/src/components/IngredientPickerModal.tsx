import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, CheckSquare } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface IngredientPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: number;
  recipeTitle: string;
  ingredients: string[];
}

export default function IngredientPickerModal({
  open,
  onOpenChange,
  recipeId,
  recipeTitle,
  ingredients,
}: IngredientPickerModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  // Reset checked ingredients when modal opens with new recipe
  useEffect(() => {
    if (open) {
      // Select all by default
      setCheckedIngredients(new Set(ingredients.map((_, idx) => idx)));
    }
  }, [open, ingredients]);

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const selectAll = () => {
    setCheckedIngredients(new Set(ingredients.map((_, idx) => idx)));
  };

  const deselectAll = () => {
    setCheckedIngredients(new Set());
  };

  const handleAddToGrocery = () => {
    const selectedIngredients = ingredients.filter((_, idx) =>
      checkedIngredients.has(idx)
    );

    if (selectedIngredients.length === 0) {
      toast({
        title: "No ingredients selected",
        description: "Please check the ingredients you want to add to your grocery list.",
        variant: "destructive",
      });
      return;
    }

    // Store recipe with selected ingredients in sessionStorage
    const groceryData = {
      recipeId,
      recipeTitle,
      ingredients: selectedIngredients,
    };

    sessionStorage.setItem("pendingGroceryItems", JSON.stringify(groceryData));

    // Close modal and navigate to grocery page
    onOpenChange(false);
    setLocation("/grocery");
  };

  const allSelected = checkedIngredients.size === ingredients.length;
  const noneSelected = checkedIngredients.size === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-ingredient-picker">
        <DialogHeader>
          <DialogTitle>Add Ingredients to Grocery List</DialogTitle>
          <DialogDescription>
            Select ingredients from "{recipeTitle}" to add to your grocery list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {checkedIngredients.size} of {ingredients.length} selected
            </span>
            <div className="flex gap-2">
              {!allSelected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  data-testid="button-select-all"
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select All
                </Button>
              )}
              {!noneSelected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  data-testid="button-deselect-all"
                >
                  Deselect All
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-4">
            {ingredients.map((ingredient, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2 rounded-md hover-elevate"
              >
                <Checkbox
                  id={`ingredient-${idx}`}
                  checked={checkedIngredients.has(idx)}
                  onCheckedChange={() => toggleIngredient(idx)}
                  data-testid={`checkbox-ingredient-${idx}`}
                />
                <label
                  htmlFor={`ingredient-${idx}`}
                  className="text-sm leading-relaxed cursor-pointer flex-1"
                >
                  {ingredient}
                </label>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={handleAddToGrocery}
            className="w-full"
            data-testid="button-add-selected-to-grocery"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add Selected to Grocery ({checkedIngredients.size})
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
            data-testid="button-cancel-ingredient-picker"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
