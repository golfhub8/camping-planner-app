import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
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

// Keep existing user schema for future use
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
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
  
  // Array of collaborator emails/names (strings)
  // Example: ["mom@example.com", "uncle@family.com"]
  collaborators: text("collaborators").array().notNull().default(sql`'{}'::text[]`),
  
  // Total grocery cost for the trip (nullable - may not be set yet)
  costTotal: text("cost_total"),
  
  // Who paid for the groceries (nullable - optional field)
  costPaidBy: text("cost_paid_by"),
  
  // When the trip was created
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for inserting a new trip (excludes auto-generated fields and defaults)
export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  location: true,
  startDate: true,
  endDate: true,
});

// Schema for adding a collaborator to a trip
export const addCollaboratorSchema = z.object({
  collaborator: z.string().trim().min(1, "Collaborator email or name is required"),
});

// Schema for adding cost information to a trip
export const addTripCostSchema = z.object({
  total: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid cost format (use numbers like 142.75)"),
  paidBy: z.string().trim().optional(),
});

// TypeScript types for working with trips
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type AddCollaborator = z.infer<typeof addCollaboratorSchema>;
export type AddTripCost = z.infer<typeof addTripCostSchema>;
