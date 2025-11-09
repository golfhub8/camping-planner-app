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
  
  // Subscription fields for printables download access
  // True if user purchased lifetime access to printables
  hasPrintableLifetime: boolean("has_printable_lifetime").notNull().default(false),
  
  // True if user has an active subscription
  isSubscriber: boolean("is_subscriber").notNull().default(false),
  
  // When the subscription ends (nullable - only set if isSubscriber is true)
  subscriptionEndDate: timestamp("subscription_end_date"),
  
  // Stripe customer ID for managing payments and subscriptions
  stripeCustomerId: varchar("stripe_customer_id"),
  
  // Stripe subscription ID for tracking active subscriptions
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  
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
export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  location: true,
  startDate: true,
  endDate: true,
}).extend({
  // Coerce ISO date strings to Date objects
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

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

// Schema for adding a meal (recipe) to a trip
export const addMealSchema = z.object({
  recipeId: z.number().int().positive("Recipe ID must be a positive integer"),
});

// TypeScript types for working with trips
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type AddCollaborator = z.infer<typeof addCollaboratorSchema>;
export type AddTripCost = z.infer<typeof addTripCostSchema>;
export type AddMeal = z.infer<typeof addMealSchema>;
