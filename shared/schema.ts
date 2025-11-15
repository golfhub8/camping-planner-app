import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, numeric, boolean, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Recipe table schema
// Stores camping recipes with title, ingredients list, preparation steps, and creation timestamp
export const recipes = pgTable("recipes", {
  // Auto-generated unique identifier for each recipe
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Recipe title (e.g., "Campfire Chili")
  title: text("title").notNull(),
  
  // Array of ingredients (e.g., ["1 lb ground beef", "2 cans kidney beans"])
  ingredients: text("ingredients").array().notNull(),
  
  // Preparation steps as an array of strings (one step per item)
  // Example: ["Heat oil in pan", "Add onions and cook until soft", "Add meat and brown"]
  steps: text("steps").array().notNull(),
  
  // Optional image URL for the recipe
  imageUrl: text("image_url"),
  
  // Optional source URL for external recipes saved to My Recipes
  // When users save an external WordPress recipe, this stores the original URL
  sourceUrl: text("source_url"),
  
  // Share token for public recipe sharing
  // Unique token that allows anyone with the link to view and save this recipe
  // Generated when user clicks "Share Recipe" button
  shareToken: varchar("share_token"),
  
  // User who created this recipe (foreign key to users table)
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // When the recipe was created
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for inserting a new recipe (excludes auto-generated fields)
export const insertRecipeSchema = createInsertSchema(recipes).pick({
  title: true,
  ingredients: true,
  steps: true,
  imageUrl: true,
  sourceUrl: true,
});

// TypeScript types for working with recipes
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// Session storage table for Replit Auth
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth with subscription fields
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  // Keep default config for id column per Replit Auth requirements
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Replit Auth fields
  // Note: Email is not unique since OIDC sub (id) is the stable unique identifier
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Pro Membership fields for printables access
  // Annual subscription at $29.99/year with 7-day free trial
  // When the pro membership expires (covers both trial and paid subscriptions)
  // If null: not a member. If future date: active member (trial or paid)
  proMembershipEndDate: timestamp("pro_membership_end_date"),
  
  // Stripe customer ID for managing payments and subscriptions
  stripeCustomerId: varchar("stripe_customer_id"),
  
  // Stripe subscription ID for tracking the annual subscription
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  
  // Stripe subscription status for efficient access checking
  // Values: 'active', 'trialing', 'past_due', 'canceled', 'incomplete', etc.
  // Updated by webhooks to avoid per-request Stripe API calls
  subscriptionStatus: varchar("subscription_status"),
  
  // Camping Basics selection
  // Array of camping basic IDs that the user has added to their grocery list
  // Example: ["water", "coffee", "eggs"] - these persist across sessions
  selectedCampingBasics: text("selected_camping_basics").array().notNull().default(sql`'{}'::text[]`),
  
  // Usage counters for free plan limits
  // Free users limited to 5 trips and 5 grocery lists
  // Pro users have unlimited access
  tripsCount: integer("trips_count").notNull().default(0),
  groceryCount: integer("grocery_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema for upserting a user (used by Replit Auth)
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// API response type for authenticated user (includes computed fields)
export type AuthUser = User & {
  isPro: boolean;
};

// Grocery List schemas
// Categories for grouping grocery items
export const groceryCategories = ["Produce", "Dairy", "Meat", "Pantry"] as const;
export type GroceryCategory = typeof groceryCategories[number];

// Individual grocery item
export const groceryItemSchema = z.object({
  name: z.string(),
  category: z.enum(groceryCategories),
  checked: z.boolean().default(false),
});

export type GroceryItem = z.infer<typeof groceryItemSchema>;

// Personal grocery item (for "My Grocery List" feature)
export const personalGroceryItemSchema = z.object({
  name: z.string(),
  amount: z.string().optional(),
  recipeIds: z.array(z.number()).default([]),
  recipeTitles: z.array(z.string()).default([]),
});

export type PersonalGroceryItem = z.infer<typeof personalGroceryItemSchema>;

// Personal Grocery Items table
// Stores user's personal grocery list items with recipe tracking and merging
export const personalGroceryItems = pgTable("personal_grocery_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // User who owns this grocery item
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Normalized ingredient key for merging (lowercase, trimmed)
  ingredientKey: text("ingredient_key").notNull(),
  
  // Display name (original casing)
  displayName: text("display_name").notNull(),
  
  // Array of amounts from different recipes
  amounts: text("amounts").array().notNull().default(sql`'{}'::text[]`),
  
  // Array of recipe IDs that use this ingredient
  recipeIds: integer("recipe_ids").array().notNull().default(sql`'{}'::integer[]`),
  
  // Array of recipe titles for display
  recipeTitles: text("recipe_titles").array().notNull().default(sql`'{}'::text[]`),
  
  // When the item was added
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Composite unique index to ensure one row per user-ingredient combination
  uniqueIndex("personal_grocery_items_user_ingredient_idx").on(table.userId, table.ingredientKey),
]);

// TypeScript types for personal grocery items
export type PersonalGroceryItemDB = typeof personalGroceryItems.$inferSelect;
export type InsertPersonalGroceryItem = typeof personalGroceryItems.$inferInsert;

// Request to generate grocery list from selected recipes
export const generateGroceryListSchema = z.object({
  recipeIds: z.array(z.number()).min(1, "Select at least one recipe"),
});

export type GenerateGroceryListRequest = z.infer<typeof generateGroceryListSchema>;

// Trip table schema
// Stores camping trips with dates, location, meals, collaborators, and cost info
export const trips = pgTable("trips", {
  // Auto-generated unique identifier for each trip
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Trip name (e.g., "Goldstream Weekend")
  name: text("name").notNull(),
  
  // Trip location (e.g., "Goldstream Provincial Park")
  location: text("location").notNull(),
  
  // Geographic coordinates for weather forecasts (optional)
  // Latitude in decimal degrees (e.g., 48.4284 for Victoria, BC)
  lat: numeric("lat", { precision: 10, scale: 6 }),
  
  // Longitude in decimal degrees (e.g., -123.3656 for Victoria, BC)
  lng: numeric("lng", { precision: 10, scale: 6 }),
  
  // Start date of the trip
  startDate: timestamp("start_date").notNull(),
  
  // End date of the trip
  endDate: timestamp("end_date").notNull(),
  
  // Array of recipe IDs attached to this trip as meals
  meals: integer("meals").array().notNull().default(sql`'{}'::integer[]`),
  
  // Array of collaborator emails/names (strings, stored in lowercase for consistency)
  // Example: ["mom@example.com", "uncle@family.com"]
  collaborators: text("collaborators").array().notNull().default(sql`'{}'::text[]`),
  
  // Total grocery cost for the trip (decimal with 2 decimal places, nullable)
  // Stored as numeric for accurate calculations
  costTotal: numeric("cost_total", { precision: 10, scale: 2 }),
  
  // Who paid for the groceries (nullable - optional field)
  costPaidBy: text("cost_paid_by"),
  
  // User who created this trip (foreign key to users table)
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // When the trip was created
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for inserting a new trip (excludes auto-generated fields and defaults)
// Coerces ISO date strings to Date objects for API compatibility
// Accepts optional lat/lng coordinates for weather forecasts
export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  location: true,
  startDate: true,
  endDate: true,
}).extend({
  // Coerce ISO date strings to Date objects
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  // Optional coordinates for weather forecasts
  // Use z.coerce.number() to handle string inputs from forms
  // Lat must be between -90 and 90, Lng must be between -180 and 180
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
}).refine(
  (data) => {
    // If one coordinate is provided, both must be provided
    const hasLat = data.lat !== null && data.lat !== undefined;
    const hasLng = data.lng !== null && data.lng !== undefined;
    return (hasLat && hasLng) || (!hasLat && !hasLng);
  },
  {
    message: "Both latitude and longitude must be provided together, or both must be empty",
  }
).refine(
  (data) => data.startDate <= data.endDate,
  {
    message: "End date must be after start date",
  }
);

// Schema for updating an existing trip
// All fields are optional to allow partial updates
// Used for PUT /api/trips/:id endpoint
export const updateTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").optional(),
  location: z.string().min(1, "Location is required").optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  // Transform coordinate inputs:
  // - Empty strings, null, undefined → null (explicit clear)
  // - Valid numbers → parsed number
  // - Invalid numbers (NaN) → null
  // This ensures null is preserved through JSON serialization
  lat: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const raw = typeof val === "string" ? parseFloat(val) : val;
      if (typeof raw !== "number" || Number.isNaN(raw)) return null;
      return raw;
    },
    z.union([z.number().min(-90).max(90), z.null()]).optional()
  ),
  lng: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const raw = typeof val === "string" ? parseFloat(val) : val;
      if (typeof raw !== "number" || Number.isNaN(raw)) return null;
      return raw;
    },
    z.union([z.number().min(-180).max(180), z.null()]).optional()
  ),
}).refine(
  (data) => {
    // If one coordinate is updated, both must be updated together
    const hasLat = data.lat !== null && data.lat !== undefined;
    const hasLng = data.lng !== null && data.lng !== undefined;
    return (hasLat && hasLng) || (!hasLat && !hasLng);
  },
  {
    message: "Both latitude and longitude must be provided together, or both must be empty",
  }
).refine(
  (data) => {
    // If both dates are provided, ensure start is before end
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true; // If only one date is provided, skip this validation
  },
  {
    message: "End date must be after start date",
  }
);

// Schema for adding a collaborator to a trip
// The collaborator string will be trimmed and normalized to lowercase
export const addCollaboratorSchema = z.object({
  collaborator: z.string().trim().min(1, "Collaborator email or name is required"),
});

// Schema for adding cost information to a trip
export const addTripCostSchema = z.object({
  total: z.number().positive("Cost must be positive").or(
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid cost format").transform(Number)
  ),
  paidBy: z.string().trim().optional(),
});

// Trip Meals table schema
// Junction table that stores recipes (internal or external) attached to trips
export const tripMeals = pgTable("trip_meals", {
  // Auto-generated unique identifier
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Associated trip ID (foreign key to trips table)
  tripId: integer("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  
  // Internal recipe ID (foreign key to recipes table, nullable for external recipes)
  recipeId: integer("recipe_id").references(() => recipes.id),
  
  // Flag indicating if this is an external WordPress recipe
  isExternal: boolean("is_external").notNull().default(false),
  
  // External recipe WordPress post ID (nullable, only for external recipes)
  externalRecipeId: text("external_recipe_id"),
  
  // Cached recipe title (for external recipes, allows display without fetching WordPress)
  title: text("title").notNull(),
  
  // Source URL for external recipes (link to full recipe on WordPress)
  sourceUrl: text("source_url"),
  
  // When this meal was added to the trip
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for adding a meal (recipe) to a trip
// Supports both internal recipes (from database) and external recipes (from WordPress)
export const addMealSchema = z.object({
  // For internal recipes: provide recipeId
  recipeId: z.number().int().positive("Recipe ID must be a positive integer").optional(),
  
  // For external recipes: provide isExternal, title, and sourceUrl
  isExternal: z.boolean().default(false),
  externalRecipeId: z.string().optional(), // WordPress post ID
  title: z.string().optional(),
  sourceUrl: z.string().url().optional(),
}).refine(
  (data) => {
    // Internal recipe: must have recipeId and not be external
    if (!data.isExternal) {
      return data.recipeId !== undefined;
    }
    // External recipe: must have externalRecipeId, title, and sourceUrl
    return data.externalRecipeId !== undefined && data.title !== undefined && data.sourceUrl !== undefined;
  },
  {
    message: "Internal recipes require recipeId. External recipes require externalRecipeId, title, and sourceUrl.",
  }
);

// Trip Packing Items table schema
// Stores custom items users want to pack for their trips
export const tripPackingItems = pgTable("trip_packing_items", {
  // Auto-generated unique identifier
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Associated trip ID (foreign key to trips table)
  tripId: integer("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  
  // Item name (e.g., "Tent", "Sleeping bag", "First aid kit")
  name: text("name").notNull(),
  
  // Whether the item is packed/checked off
  packed: boolean("packed").notNull().default(false),
  
  // Optional category for grouping items
  category: text("category"),
  
  // When this item was added
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for adding a packing item to a trip
export const addPackingItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required"),
  category: z.string().trim().optional(),
});

// Schema for updating a packing item (toggle packed status or edit name)
export const updatePackingItemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").optional(),
  packed: z.boolean().optional(),
  category: z.string().trim().optional(),
});

// TypeScript types for working with trips and trip meals
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type UpdateTrip = z.infer<typeof updateTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type AddCollaborator = z.infer<typeof addCollaboratorSchema>;
export type AddTripCost = z.infer<typeof addTripCostSchema>;
export type AddMeal = z.infer<typeof addMealSchema>;
export type TripMeal = typeof tripMeals.$inferSelect;
export type TripPackingItem = typeof tripPackingItems.$inferSelect;
export type AddPackingItem = z.infer<typeof addPackingItemSchema>;
export type UpdatePackingItem = z.infer<typeof updatePackingItemSchema>;

// Shared Grocery Lists table schema
// Stores shareable grocery lists with unique tokens for public access
export const sharedGroceryLists = pgTable("shared_grocery_lists", {
  // Auto-generated unique identifier
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Unique token for sharing (URL-safe random string)
  token: varchar("token", { length: 32 }).notNull().unique(),
  
  // Associated trip ID (nullable - can share grocery list without trip)
  tripId: integer("trip_id"),
  
  // Trip name for display purposes (nullable)
  tripName: text("trip_name"),
  
  // Array of grocery items (stored as JSONB)
  items: jsonb("items").notNull(),
  
  // Array of collaborator emails/names who should receive notifications
  collaborators: text("collaborators").array().notNull().default(sql`'{}'::text[]`),
  
  // User who created this shared list
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // When the link expires (nullable - if null, never expires)
  expiresAt: timestamp("expires_at"),
  
  // When the shared list was created
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for creating a shared grocery list
export const createSharedGroceryListSchema = z.object({
  tripId: z.number().optional(),
  tripName: z.string().optional(),
  items: z.array(groceryItemSchema).min(1, "At least one item is required"),
  collaborators: z.array(z.string().email()).default([]),
  expiresAt: z.coerce.date().optional(),
});

// Schema for sending notifications about a shared list
export const sendGroceryNotificationSchema = z.object({
  shareToken: z.string(),
  recipients: z.array(z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })).min(1, "At least one recipient is required"),
  message: z.string().optional(),
});

// TypeScript types for shared grocery lists
export type CreateSharedGroceryList = z.infer<typeof createSharedGroceryListSchema>;
export type SendGroceryNotification = z.infer<typeof sendGroceryNotificationSchema>;
export type SharedGroceryList = typeof sharedGroceryLists.$inferSelect;

// Campground schema for Camping Map feature
// In-memory data (not persisted to database)
// Represents campgrounds and outdoor recreation areas
export const campgroundSchema = z.object({
  // Unique identifier for the campground
  id: z.string(),
  
  // Name of the campground (e.g., "Goldstream Provincial Park")
  name: z.string(),
  
  // Type of campground (e.g., "Provincial Park", "National Park", "Private Campground")
  type: z.string().optional(),
  
  // Location description (e.g., "Victoria, BC" or "Washington State")
  location: z.string(),
  
  // Geographic coordinates for map display
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  
  // Brief description of the campground
  description: z.string().optional(),
});

// Schema for searching campgrounds by location query
export const searchCampgroundsSchema = z.object({
  // Location search query (e.g., "Victoria BC", "Olympic National Park")
  query: z.string().min(1, "Location is required"),
});

// TypeScript types for campgrounds
export type Campground = z.infer<typeof campgroundSchema>;
export type SearchCampgroundsRequest = z.infer<typeof searchCampgroundsSchema>;

// Camping Basics feature
// Static list of common camping groceries that users can quickly add to their lists
// These are shared across all users and defined once
// IMPORTANT: To add more basics, simply add new entries to this array with unique IDs
export const CAMPING_BASICS = [
  { id: "water", name: "Drinking water / jugs", category: "Pantry" as const },
  { id: "coffee", name: "Coffee / tea", category: "Pantry" as const },
  { id: "milk", name: "Milk / creamer", category: "Dairy" as const },
  { id: "eggs", name: "Eggs", category: "Dairy" as const },
  { id: "bread", name: "Bread / buns / tortillas", category: "Pantry" as const },
  { id: "butter", name: "Butter / cooking oil / spray", category: "Dairy" as const },
  { id: "condiments", name: "Ketchup, mustard, relish", category: "Pantry" as const },
  { id: "snacks", name: "Trail mix / granola bars / chips", category: "Pantry" as const },
  { id: "fruit", name: "Apples / oranges / berries", category: "Produce" as const },
  { id: "veg", name: "Carrots / peppers / onions", category: "Produce" as const },
  { id: "meat", name: "Protein (hot dogs, burgers, sausage)", category: "Meat" as const },
  { id: "smores", name: "S'mores kit (graham, chocolate, marshmallows)", category: "Pantry" as const },
  { id: "spices", name: "Salt, pepper, basic spices", category: "Pantry" as const },
  { id: "ice", name: "Ice / ice packs", category: "Pantry" as const },
  { id: "foil", name: "Aluminum foil / zip bags", category: "Pantry" as const },
  { id: "paper", name: "Paper towel / napkins", category: "Pantry" as const },
] as const;

// Extract valid camping basic IDs for validation
const CAMPING_BASIC_IDS = CAMPING_BASICS.map(basic => basic.id) as [string, ...string[]];

// Schema for camping basic operations
// Only accepts IDs that exist in the CAMPING_BASICS array
export const addCampingBasicSchema = z.object({
  basicId: z.enum(CAMPING_BASIC_IDS, {
    errorMap: () => ({ message: "Invalid camping basic ID - must be one of the predefined basics" })
  }),
});

export type AddCampingBasicRequest = z.infer<typeof addCampingBasicSchema>;

// Trip Assistant schemas for AI-powered trip planning suggestions
// Request schema for trip assistant endpoint
export const tripAssistantRequestSchema = z.object({
  tripId: z.number().optional(),
  prompt: z.string().min(1, "Please describe what you're looking for"),
  season: z.enum(["spring", "summer", "fall", "winter"]).optional(),
  groupSize: z.number().min(1).optional(),
});

export type TripAssistantRequest = z.infer<typeof tripAssistantRequestSchema>;

// Campground suggestion schema
export const campgroundSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  distanceHours: z.number(),
  highlights: z.array(z.string()),
  recommendedSeasons: z.array(z.string()),
});

export type CampgroundSuggestion = z.infer<typeof campgroundSuggestionSchema>;

// Meal plan suggestion schema
export const mealPlanSuggestionSchema = z.object({
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  title: z.string(),
  description: z.string(),
  requiredGear: z.array(z.string()),
  prepTime: z.string(),
  ingredients: z.array(z.string()),
});

export type MealPlanSuggestion = z.infer<typeof mealPlanSuggestionSchema>;

// Trail suggestion schema for hiking recommendations
export const trailSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  distance: z.number().optional(),
  elevationGain: z.number().optional(),
  difficulty: z.enum(["easy", "moderate", "hard"]),
  highlights: z.array(z.string()),
  estimatedTime: z.string(),
  parkName: z.string().optional(),
  url: z.string().optional(),
});

export type TrailSuggestion = z.infer<typeof trailSuggestionSchema>;

// Response schema for trip assistant endpoint
export const tripAssistantResponseSchema = z.object({
  campgrounds: z.array(campgroundSuggestionSchema),
  mealPlan: z.array(mealPlanSuggestionSchema),
  packingTips: z.array(z.string()),
  trails: z.array(trailSuggestionSchema),
  warnings: z.array(z.string()).optional(),
});

export type TripAssistantResponse = z.infer<typeof tripAssistantResponseSchema>;
