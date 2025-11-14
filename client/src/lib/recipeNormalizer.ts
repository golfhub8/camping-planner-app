/**
 * Shared recipe normalization utilities
 * Ensures consistent ingredient and step formatting across all recipe entry points:
 * - SaveRecipeModal (external recipes)
 * - RecipeForm (manual creation)
 * - Server-side parsing
 */

/**
 * Normalize ingredients from textarea input to array format
 * - Splits on newlines
 * - Trims whitespace
 * - Removes empty lines
 * - Cleans up bullet points and formatting
 */
export function normalizeIngredients(input: string): string[] {
  return input
    .split("\n")
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
 * Normalize steps/instructions from textarea input to array format
 * - Splits on single newlines (each line is a step)
 * - Trims whitespace
 * - Removes numbered/bulleted prefixes
 * - Removes empty steps
 */
export function normalizeSteps(input: string): string[] {
  return input
    .split('\n') // Split on each newline
    .map(step => {
      // Remove leading bullets, numbers, dashes, asterisks
      let cleaned = step.trim().replace(/^(\d+\.\s*|[-•*]\s*)/, "");
      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, " ");
      return cleaned;
    })
    .filter(step => step.length > 0);
}

/**
 * Normalize full recipe data from form inputs
 * Returns data ready for API submission
 */
export interface RecipeInput {
  title: string;
  ingredientsText: string;
  stepsText: string;
  imageUrl?: string;
  sourceUrl?: string;
}

export interface NormalizedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string;
  sourceUrl?: string;
}

export function normalizeRecipeInputs(input: RecipeInput): NormalizedRecipe {
  return {
    title: input.title.trim(),
    ingredients: normalizeIngredients(input.ingredientsText),
    steps: normalizeSteps(input.stepsText),
    imageUrl: input.imageUrl?.trim() || undefined,
    sourceUrl: input.sourceUrl?.trim() || undefined,
  };
}
