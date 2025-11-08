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
