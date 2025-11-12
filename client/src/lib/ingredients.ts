// Utility functions for ingredient normalization and merging

export interface ParsedIngredient {
  original: string;
  normalized: string;
  amount?: string;
  unit?: string;
  name: string;
}

// Normalize ingredient text for comparison (lowercase, trim, collapse whitespace)
export function normalizeIngredientKey(ingredient: string): string {
  return ingredient
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove punctuation for better matching
}

// Parse ingredient into amount, unit, and name
export function parseIngredient(ingredient: string): ParsedIngredient {
  const trimmed = ingredient.trim();
  
  // Try to match number + optional unit + name pattern
  const match = trimmed.match(/^([\d./]+\s*\w*)\s+(.+)$/);
  
  if (match) {
    const [, amountPart, namePart] = match;
    return {
      original: trimmed,
      normalized: normalizeIngredientKey(namePart),
      amount: amountPart.trim(),
      name: namePart.trim()
    };
  }
  
  // No amount detected, treat whole thing as name
  return {
    original: trimmed,
    normalized: normalizeIngredientKey(trimmed),
    name: trimmed
  };
}

// Combine amounts from multiple ingredients
export function combineAmounts(amounts: string[]): string {
  if (amounts.length === 0) return '';
  if (amounts.length === 1) return amounts[0];
  
  // Try to sum if all amounts are simple numbers
  const numbers = amounts.map(a => parseFloat(a.replace(/[^\d.]/g, '')));
  const allNumbers = numbers.every(n => !isNaN(n));
  
  if (allNumbers) {
    const total = numbers.reduce((sum, n) => sum + n, 0);
    // Extract unit from first amount
    const unit = amounts[0].replace(/[\d./\s]/g, '').trim();
    return `${total}${unit ? ' ' + unit : ''}`;
  }
  
  // Fall back to list concatenation
  return amounts.join(' + ');
}

// Merge duplicate ingredients from multiple recipes
export interface MergedIngredient {
  name: string;
  amounts: string[];
  recipes: { id: number; title: string }[];
  combinedAmount?: string;
}

export function mergeIngredients(
  recipeIngredients: Array<{
    recipeId: number;
    recipeTitle: string;
    ingredients: string[];
  }>
): MergedIngredient[] {
  const ingredientMap = new Map<string, MergedIngredient>();
  
  for (const { recipeId, recipeTitle, ingredients } of recipeIngredients) {
    for (const ingredient of ingredients) {
      const parsed = parseIngredient(ingredient);
      const key = parsed.normalized;
      
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        if (parsed.amount) {
          existing.amounts.push(parsed.amount);
        }
        // Only add recipe if not already in list
        if (!existing.recipes.some(r => r.id === recipeId)) {
          existing.recipes.push({ id: recipeId, title: recipeTitle });
        }
      } else {
        ingredientMap.set(key, {
          name: parsed.name,
          amounts: parsed.amount ? [parsed.amount] : [],
          recipes: [{ id: recipeId, title: recipeTitle }]
        });
      }
    }
  }
  
  // Calculate combined amounts
  const merged = Array.from(ingredientMap.values());
  merged.forEach(ing => {
    if (ing.amounts.length > 0) {
      ing.combinedAmount = combineAmounts(ing.amounts);
    }
  });
  
  return merged;
}
