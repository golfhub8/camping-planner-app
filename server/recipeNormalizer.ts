/**
 * Server-side recipe normalization utilities
 * Ensures consistent ingredient and step formatting in the database
 * Mirrors client-side logic in client/src/lib/recipeNormalizer.ts
 */

/**
 * Normalize ingredients array
 * - Removes empty strings
 * - Trims whitespace
 * - Removes bullet points and formatting
 */
export function normalizeIngredients(input: string[]): string[] {
  return input
    .map(line => {
      // Remove bullet points, dashes, asterisks at the start
      let cleaned = line.trim().replace(/^[-•*]\s*/, "");
      // Remove extra whitespace
      cleaned = cleaned.replace(/\s+/g, " ");
      return cleaned;
    })
    .filter(line => line.length > 0);
}

/**
 * Normalize steps/instructions array
 * - Removes empty strings
 * - Trims whitespace
 * - Removes numbered/bulleted prefixes
 * - Normalizes internal formatting
 */
export function normalizeSteps(input: string[]): string[] {
  return input
    .map(step => {
      // Remove leading bullets, numbers, dashes, asterisks (matches client logic)
      let cleaned = step.trim().replace(/^(\d+\.\s*|[-•*]\s*)/, "");
      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, " ");
      return cleaned;
    })
    .filter(step => step.length > 0);
}

/**
 * Normalize full recipe data before persistence
 * Ensures all recipes have consistent formatting in the database
 */
export interface RecipePayload {
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string | null;
  sourceUrl?: string | null;
}

export function normalizeRecipePayload(payload: RecipePayload): RecipePayload {
  return {
    title: payload.title.trim(),
    ingredients: normalizeIngredients(payload.ingredients),
    steps: normalizeSteps(payload.steps),
    imageUrl: payload.imageUrl?.trim() || undefined,
    sourceUrl: payload.sourceUrl?.trim() || undefined,
  };
}
