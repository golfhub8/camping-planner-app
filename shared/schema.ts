import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, numeric, boolean, index, jsonb } from "drizzle-orm/pg-core";
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
  
  // Preparation steps as a single text block
  steps: text("steps").notNull(),
  
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
  email: varchar("email").unique(),
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
  
  // Camping Basics selection
  // Array of camping basic IDs that the user has added to their grocery list
  // Example: ["water", "coffee", "eggs"] - these persist across sessions
  selectedCampingBasics: text("selected_camping_basics").array().notNull().default(sql`'{}'::text[]`),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema for upserting a user (used by Replit Auth)
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Grocery List schemas
// Categories for grouping grocery items
export const groceryCategories = ["Produce", "Dairy", "Meat", "Pantry", "Camping Gear"] as const;
export type GroceryCategory = typeof groceryCategories[number];

// Individual grocery item
export const groceryItemSchema = z.object({
  name: z.string(),
  category: z.enum(groceryCategories),
  checked: z.boolean().default(false),
});

export type GroceryItem = z.infer<typeof groceryItemSchema>;

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
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    },
    z.union([z.number().min(-90).max(90), z.null()]).optional()
  ),
  lng: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
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

// TypeScript types for working with trips and trip meals
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type UpdateTrip = z.infer<typeof updateTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type AddCollaborator = z.infer<typeof addCollaboratorSchema>;
export type AddTripCost = z.infer<typeof addTripCostSchema>;
export type AddMeal = z.infer<typeof addMealSchema>;
export type TripMeal = typeof tripMeals.$inferSelect;

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
  { id: "ice", name: "Ice / ice packs", category: "Camping Gear" as const },
  { id: "foil", name: "Aluminum foil / zip bags", category: "Camping Gear" as const },
  { id: "paper", name: "Paper towel / napkins", category: "Camping Gear" as const },
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
