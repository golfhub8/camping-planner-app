/**
 * Recipe Scraper Utility
 * 
 * Parses recipe data from external URLs using JSON-LD structured data
 * and other fallback methods. Extracts title, ingredients, steps, and images.
 */

export interface ScrapedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string;
  sourceUrl: string;
}

/**
 * Extract JSON-LD recipe data from HTML content
 * 
 * Looks for <script type="application/ld+json"> tags with @type "Recipe"
 * and extracts structured recipe information
 */
function extractJsonLd(html: string): ScrapedRecipe | null {
  try {
    // Find all JSON-LD script tags
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        // Handle both single objects and arrays of objects
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const item of recipes) {
          // Check if this is a Recipe object (can be nested in @graph)
          const recipe = item['@type'] === 'Recipe' ? item : 
                        item['@graph']?.find((g: any) => g['@type'] === 'Recipe');
          
          if (!recipe) continue;
          
          // Extract title
          const title = recipe.name || recipe.headline || '';
          if (!title) continue;
          
          // Extract ingredients (can be array of strings or objects)
          let ingredients: string[] = [];
          if (Array.isArray(recipe.recipeIngredient)) {
            ingredients = recipe.recipeIngredient.map((ing: any) => 
              typeof ing === 'string' ? ing : ing.text || ''
            ).filter(Boolean);
          }
          
          // Extract steps/instructions
          let steps: string[] = [];
          if (recipe.recipeInstructions) {
            if (typeof recipe.recipeInstructions === 'string') {
              // Split string instructions into steps
              steps = recipe.recipeInstructions
                .split(/\n+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s && s.length > 10); // Filter out empty or very short lines
            } else if (Array.isArray(recipe.recipeInstructions)) {
              steps = recipe.recipeInstructions.map((step: any) => {
                if (typeof step === 'string') return step;
                if (step['@type'] === 'HowToStep') return step.text || step.name || '';
                if (step.text) return step.text;
                return '';
              }).filter(Boolean);
            }
          }
          
          // Extract image URL
          let imageUrl: string | undefined;
          if (recipe.image) {
            if (typeof recipe.image === 'string') {
              imageUrl = recipe.image;
            } else if (Array.isArray(recipe.image)) {
              imageUrl = recipe.image[0];
            } else if (recipe.image.url) {
              imageUrl = recipe.image.url;
            }
          }
          
          // Only return if we have at least title and ingredients
          if (title && ingredients.length > 0) {
            return {
              title,
              ingredients,
              steps,
              imageUrl,
              sourceUrl: '', // Will be filled in by caller
            };
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON-LD block:', parseError);
        continue; // Try next JSON-LD block
      }
    }
  } catch (error) {
    console.error('Error extracting JSON-LD:', error);
  }
  
  return null;
}

/**
 * Fetch and parse a recipe from a URL
 * 
 * Makes a CORS-friendly request through the backend proxy
 * and attempts to extract recipe data using JSON-LD
 */
export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  try {
    // Fetch HTML content through backend proxy to avoid CORS issues
    const response = await fetch(`/api/recipes/scrape?url=${encodeURIComponent(url)}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch recipe: ${response.statusText}`);
    }
    
    const { html } = await response.json();
    
    // Try JSON-LD extraction first
    const jsonLdRecipe = extractJsonLd(html);
    if (jsonLdRecipe) {
      return {
        ...jsonLdRecipe,
        sourceUrl: url,
      };
    }
    
    // If JSON-LD extraction failed, return minimal data
    // The user can manually fill in the details
    return {
      title: '',
      ingredients: [],
      steps: [],
      sourceUrl: url,
    };
  } catch (error) {
    console.error('Recipe scraping error:', error);
    throw new Error('Failed to scrape recipe. Please enter the recipe details manually.');
  }
}

/**
 * Parse ingredients from raw text content
 * 
 * Fallback method for when structured data isn't available.
 * Looks for common ingredient list patterns in HTML content.
 */
export function parseIngredientsFromContent(html: string): string[] {
  // Remove script and style tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '\n');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  
  // Look for lines that look like ingredients
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Must be between 5 and 200 characters
      if (line.length < 5 || line.length > 200) return false;
      
      // Look for quantity indicators (numbers, fractions, measurements)
      const hasQuantity = /\d|cup|tbsp|tsp|oz|lb|gram|kg|ml|liter/i.test(line);
      
      // Exclude lines that look like headings or instructions
      const looksLikeHeading = line.endsWith(':') || line === line.toUpperCase();
      const looksLikeInstruction = /^(step|add|mix|combine|heat|cook|bake|stir)/i.test(line);
      
      return hasQuantity && !looksLikeHeading && !looksLikeInstruction;
    });
  
  return lines.slice(0, 50); // Limit to 50 ingredients max
}
