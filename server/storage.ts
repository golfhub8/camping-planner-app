import { type User, type InsertUser, type Recipe, type InsertRecipe } from "@shared/schema";
import { randomUUID } from "crypto";

// Storage interface definition
// This defines all the methods we need to store and retrieve data
export interface IStorage {
  // User methods (for future authentication features)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Recipe methods
  // Get all recipes (returns newest first)
  getAllRecipes(): Promise<Recipe[]>;
  
  // Get a single recipe by its ID
  getRecipeById(id: number): Promise<Recipe | undefined>;
  
  // Create a new recipe
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  
  // Search recipes by title (case-insensitive)
  searchRecipes(query: string): Promise<Recipe[]>;
}

// In-memory storage implementation
// This stores all data in memory (data is lost when server restarts)
// Good for development and prototyping
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private recipes: Map<number, Recipe>;
  private nextRecipeId: number;

  constructor() {
    this.users = new Map();
    this.recipes = new Map();
    this.nextRecipeId = 1;
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Recipe methods
  async getAllRecipes(): Promise<Recipe[]> {
    // Return all recipes, sorted by creation date (newest first)
    return Array.from(this.recipes.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getRecipeById(id: number): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async createRecipe(insertRecipe: InsertRecipe): Promise<Recipe> {
    // Create a new recipe with auto-generated ID and timestamp
    const recipe: Recipe = {
      ...insertRecipe,
      id: this.nextRecipeId++,
      createdAt: new Date(),
    };
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    // Search for recipes where title contains the query (case-insensitive)
    const lowerQuery = query.toLowerCase();
    return Array.from(this.recipes.values())
      .filter((recipe) => recipe.title.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const storage = new MemStorage();
