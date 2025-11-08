import { type User, type InsertUser, type Recipe, type InsertRecipe, type Trip, type InsertTrip } from "@shared/schema";
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
  
  // Trip methods
  // Get all trips (returns newest first)
  getAllTrips(): Promise<Trip[]>;
  
  // Get a single trip by its ID
  getTripById(id: number): Promise<Trip | undefined>;
  
  // Create a new trip
  createTrip(trip: InsertTrip): Promise<Trip>;
  
  // Add a collaborator to a trip
  addCollaborator(tripId: number, collaborator: string): Promise<Trip | undefined>;
  
  // Update cost information for a trip
  updateTripCost(tripId: number, total: string, paidBy?: string): Promise<Trip | undefined>;
}

// In-memory storage implementation
// This stores all data in memory (data is lost when server restarts)
// Good for development and prototyping
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private recipes: Map<number, Recipe>;
  private trips: Map<number, Trip>;
  private nextRecipeId: number;
  private nextTripId: number;

  constructor() {
    this.users = new Map();
    this.recipes = new Map();
    this.trips = new Map();
    this.nextRecipeId = 1;
    this.nextTripId = 1;
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

  // Trip methods
  async getAllTrips(): Promise<Trip[]> {
    // Return all trips, sorted by start date (newest first)
    return Array.from(this.trips.values()).sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime()
    );
  }

  async getTripById(id: number): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    // Create a new trip with auto-generated ID, timestamp, and empty arrays
    const trip: Trip = {
      ...insertTrip,
      id: this.nextTripId++,
      meals: [],
      collaborators: [],
      costTotal: null,
      costPaidBy: null,
      createdAt: new Date(),
    };
    this.trips.set(trip.id, trip);
    return trip;
  }

  async addCollaborator(tripId: number, collaborator: string): Promise<Trip | undefined> {
    // Find the trip
    const trip = this.trips.get(tripId);
    if (!trip) {
      return undefined;
    }

    // Don't add if already exists (case-insensitive check)
    const lowerCollaborator = collaborator.toLowerCase();
    const exists = trip.collaborators.some(
      c => c.toLowerCase() === lowerCollaborator
    );

    if (!exists) {
      // Add the collaborator to the array
      trip.collaborators.push(collaborator);
    }

    return trip;
  }

  async updateTripCost(tripId: number, total: string, paidBy?: string): Promise<Trip | undefined> {
    // Find the trip
    const trip = this.trips.get(tripId);
    if (!trip) {
      return undefined;
    }

    // Update the cost fields
    trip.costTotal = total;
    trip.costPaidBy = paidBy || null;

    return trip;
  }
}

export const storage = new MemStorage();
