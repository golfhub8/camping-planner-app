import type { GroceryCategory } from "@shared/schema";

// Categorize an ingredient by analyzing keywords in its name
// This matches the server-side categorization logic for consistency
export function categorizeIngredient(ingredient: string): GroceryCategory {
  const lower = ingredient.toLowerCase();
  
  // Produce keywords
  if (/(tomato|lettuce|onion|pepper|carrot|potato|celery|garlic|mushroom|broccoli|spinach|cucumber|zucchini|corn|pea|bean|apple|banana|orange|lemon|lime|berry|fruit|vegetable)/i.test(lower)) {
    return "Produce";
  }
  
  // Dairy keywords
  if (/(milk|cheese|butter|cream|yogurt|sour cream|cottage cheese|cheddar|mozzarella|parmesan)/i.test(lower)) {
    return "Dairy";
  }
  
  // Meat keywords
  if (/(beef|chicken|pork|turkey|fish|salmon|tuna|bacon|sausage|ham|steak|ground beef|meat)/i.test(lower)) {
    return "Meat";
  }
  
  // Camping Gear keywords
  if (/(foil|paper|plate|cup|napkin|utensil|fork|knife|spoon|lighter|match|firewood|charcoal|grill)/i.test(lower)) {
    return "Camping Gear";
  }
  
  // Default to Pantry for everything else (spices, canned goods, oils, etc.)
  return "Pantry";
}
