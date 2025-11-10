import { type User, type UpsertUser, type Recipe, type InsertRecipe, type Trip, type InsertTrip, type SharedGroceryList, type CreateSharedGroceryList, users, recipes, trips, sharedGroceryLists } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

// Storage interface definition
// This defines all the methods we need to store and retrieve data
export interface IStorage {
  // User methods (IMPORTANT: required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stripe methods for payment integration
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateStripeSubscriptionId(userId: string, subscriptionId: string): Promise<User>;
  updateProMembershipEndDate(userId: string, endDate: Date | null): Promise<User>;
  
  // Recipe methods
  // Get all recipes for a user (returns newest first)
  getAllRecipes(userId: string): Promise<Recipe[]>;
  
  // Get a single recipe by its ID (with ownership check)
  getRecipeById(id: number, userId: string): Promise<Recipe | undefined>;
  
  // Create a new recipe for a user
  createRecipe(recipe: InsertRecipe, userId: string): Promise<Recipe>;
  
  // Search recipes by title (case-insensitive) for a user
  searchRecipes(query: string, userId: string): Promise<Recipe[]>;
  
  // Trip methods
  // Get all trips for a user (returns newest first)
  getAllTrips(userId: string): Promise<Trip[]>;
  
  // Get a single trip by its ID (with ownership check)
  getTripById(id: number, userId: string): Promise<Trip | undefined>;
  
  // Create a new trip for a user
  createTrip(trip: InsertTrip, userId: string): Promise<Trip>;
  
  // Add a collaborator to a trip (with ownership check)
  addCollaborator(tripId: number, collaborator: string, userId: string): Promise<Trip | undefined>;
  
  // Update cost information for a trip (with ownership check)
  updateTripCost(tripId: number, total: number, userId: string, paidBy?: string): Promise<Trip | undefined>;
  
  // Add a recipe (meal) to a trip (with ownership check)
  addMealToTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined>;
  
  // Remove a recipe (meal) from a trip (with ownership check)
  removeMealFromTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined>;
  
  // Shared Grocery List methods
  // Create a shareable grocery list with a unique token
  createSharedGroceryList(data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList>;
  
  // Get a shared grocery list by its token (public access - no ownership check)
  getSharedGroceryListByToken(token: string): Promise<SharedGroceryList | undefined>;
  
  // Upsert a shared grocery list for a trip (replaces any existing share for that trip)
  upsertSharedGroceryListByTrip(tripId: number, data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList>;
  
  // Get the current shared grocery list for a trip (returns undefined if none exists)
  getSharedGroceryListByTrip(tripId: number): Promise<SharedGroceryList | undefined>;
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

  // User methods (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id!);
    const user: User = {
      id: userData.id || randomUUID(),
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      proMembershipEndDate: existingUser?.proMembershipEndDate ?? null,
      stripeCustomerId: existingUser?.stripeCustomerId ?? null,
      stripeSubscriptionId: existingUser?.stripeSubscriptionId ?? null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Stripe payment integration methods
  async updateStripeCustomerId(userId: string, customerId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.stripeCustomerId = customerId;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async updateStripeSubscriptionId(userId: string, subscriptionId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.stripeSubscriptionId = subscriptionId;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async updateProMembershipEndDate(userId: string, endDate: Date | null): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.proMembershipEndDate = endDate;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  // Recipe methods
  async getAllRecipes(userId: string): Promise<Recipe[]> {
    // Return all recipes for this user, sorted by creation date (newest first)
    return Array.from(this.recipes.values())
      .filter(recipe => recipe.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecipeById(id: number, userId: string): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(id);
    // Only return if user owns this recipe
    if (recipe && recipe.userId === userId) {
      return recipe;
    }
    return undefined;
  }

  async createRecipe(insertRecipe: InsertRecipe, userId: string): Promise<Recipe> {
    // Create a new recipe with auto-generated ID, timestamp, and userId
    const recipe: Recipe = {
      ...insertRecipe,
      id: this.nextRecipeId++,
      userId,
      createdAt: new Date(),
    };
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  async searchRecipes(query: string, userId: string): Promise<Recipe[]> {
    // Search for recipes where title contains the query (case-insensitive) for this user
    const lowerQuery = query.toLowerCase();
    return Array.from(this.recipes.values())
      .filter((recipe) => recipe.userId === userId && recipe.title.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Trip methods
  async getAllTrips(userId: string): Promise<Trip[]> {
    // Return all trips for this user, sorted by start date (newest first)
    return Array.from(this.trips.values())
      .filter(trip => trip.userId === userId)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }

  async getTripById(id: number, userId: string): Promise<Trip | undefined> {
    const trip = this.trips.get(id);
    // Only return if user owns this trip
    if (trip && trip.userId === userId) {
      return trip;
    }
    return undefined;
  }

  async createTrip(insertTrip: InsertTrip, userId: string): Promise<Trip> {
    // Create a new trip with auto-generated ID, timestamp, userId, and empty arrays
    const trip: Trip = {
      ...insertTrip,
      id: this.nextTripId++,
      userId,
      meals: [],
      collaborators: [],
      costTotal: null,
      costPaidBy: null,
      createdAt: new Date(),
    };
    this.trips.set(trip.id, trip);
    return trip;
  }

  async addCollaborator(tripId: number, collaborator: string, userId: string): Promise<Trip | undefined> {
    // Find the trip and verify ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
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

  async updateTripCost(tripId: number, total: number, userId: string, paidBy?: string): Promise<Trip | undefined> {
    // Find the trip and verify ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return undefined;
    }

    // Update the cost fields (store as string with 2 decimal places)
    trip.costTotal = total.toFixed(2);
    trip.costPaidBy = paidBy || null;

    return trip;
  }

  async addMealToTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined> {
    // Find the trip and verify ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return undefined;
    }

    // Don't add if recipe is already in meals
    if (trip.meals.includes(recipeId)) {
      return trip;
    }

    // Add the recipe to the meals array
    trip.meals.push(recipeId);

    return trip;
  }

  async removeMealFromTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined> {
    // Find the trip and verify ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return undefined;
    }

    // Remove the recipe from meals array
    trip.meals = trip.meals.filter(id => id !== recipeId);

    return trip;
  }

  // Shared Grocery List methods
  private sharedLists: Map<string, SharedGroceryList> = new Map();
  private nextSharedListId: number = 1;

  async createSharedGroceryList(data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList> {
    // Generate a unique token for sharing (URL-safe random string)
    const token = randomUUID().replace(/-/g, '').substring(0, 32);
    
    const sharedList: SharedGroceryList = {
      id: this.nextSharedListId++,
      token,
      tripId: data.tripId ?? null,
      tripName: data.tripName ?? null,
      items: data.items as any,
      collaborators: data.collaborators,
      userId,
      expiresAt: data.expiresAt ?? null,
      createdAt: new Date(),
    };

    this.sharedLists.set(token, sharedList);
    return sharedList;
  }

  async getSharedGroceryListByToken(token: string): Promise<SharedGroceryList | undefined> {
    const sharedList = this.sharedLists.get(token);
    
    // Check if the link has expired
    if (sharedList && sharedList.expiresAt && sharedList.expiresAt < new Date()) {
      return undefined;
    }
    
    return sharedList;
  }

  async upsertSharedGroceryListByTrip(tripId: number, data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList> {
    // Remove any existing shared list for this trip
    const entries = Array.from(this.sharedLists.entries());
    for (const [token, list] of entries) {
      if (list.tripId === tripId) {
        this.sharedLists.delete(token);
      }
    }
    
    // Create a new shared list with the trip data
    return this.createSharedGroceryList({ ...data, tripId }, userId);
  }

  async getSharedGroceryListByTrip(tripId: number): Promise<SharedGroceryList | undefined> {
    // Find the shared list for this trip
    const lists = Array.from(this.sharedLists.values());
    for (const list of lists) {
      if (list.tripId === tripId) {
        // Check if the link has expired
        if (list.expiresAt && list.expiresAt < new Date()) {
          return undefined;
        }
        return list;
      }
    }
    return undefined;
  }
}

// Database storage implementation
// Uses PostgreSQL database for persistent storage
// Data survives server restarts
export class DatabaseStorage implements IStorage {
  // User methods (IMPORTANT: required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Insert or update user on conflict (Replit Auth requirement)
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Stripe payment integration methods
  async updateStripeCustomerId(userId: string, customerId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId: customerId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateStripeSubscriptionId(userId: string, subscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async updateProMembershipEndDate(userId: string, endDate: Date | null): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        proMembershipEndDate: endDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // Recipe methods
  async getAllRecipes(userId: string): Promise<Recipe[]> {
    // Get all recipes for this user only
    return await db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.createdAt));
  }

  async getRecipeById(id: number, userId: string): Promise<Recipe | undefined> {
    // Get recipe only if user owns it
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.id} = ${id} AND ${recipes.userId} = ${userId}`);
    return recipe || undefined;
  }

  async createRecipe(insertRecipe: InsertRecipe, userId: string): Promise<Recipe> {
    // Create recipe with userId
    const [recipe] = await db
      .insert(recipes)
      .values({ ...insertRecipe, userId })
      .returning();
    return recipe;
  }

  async searchRecipes(query: string, userId: string): Promise<Recipe[]> {
    // Search for recipes where title contains the query (case-insensitive) for this user
    return await db
      .select()
      .from(recipes)
      .where(sql`LOWER(${recipes.title}) LIKE LOWER(${'%' + query + '%'}) AND ${recipes.userId} = ${userId}`)
      .orderBy(desc(recipes.createdAt));
  }

  // Trip methods
  async getAllTrips(userId: string): Promise<Trip[]> {
    // Get all trips for this user only
    return await db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.startDate));
  }

  async getTripById(id: number, userId: string): Promise<Trip | undefined> {
    // Get trip only if user owns it
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${id} AND ${trips.userId} = ${userId}`);
    return trip || undefined;
  }

  async createTrip(insertTrip: InsertTrip, userId: string): Promise<Trip> {
    // Create trip with userId
    const [trip] = await db
      .insert(trips)
      .values({ ...insertTrip, userId })
      .returning();
    return trip;
  }

  async addCollaborator(tripId: number, collaborator: string, userId: string): Promise<Trip | undefined> {
    // Get the current trip and verify ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // Normalize collaborator: trim and lowercase for consistent storage and matching
    const normalizedCollaborator = collaborator.trim().toLowerCase();
    
    // Check if collaborator already exists (already normalized in storage)
    const exists = trip.collaborators.some(
      c => c === normalizedCollaborator
    );

    if (!exists) {
      // Add the normalized collaborator to the array
      const updatedCollaborators = [...trip.collaborators, normalizedCollaborator];
      
      // Update the trip in the database
      const [updatedTrip] = await db
        .update(trips)
        .set({ collaborators: updatedCollaborators })
        .where(eq(trips.id, tripId))
        .returning();
      
      return updatedTrip;
    }

    return trip;
  }

  async updateTripCost(tripId: number, total: number, userId: string, paidBy?: string): Promise<Trip | undefined> {
    // Update trip cost only if user owns the trip
    const [trip] = await db
      .update(trips)
      .set({
        costTotal: total.toFixed(2), // Store as string with 2 decimal places
        costPaidBy: paidBy || null,
      })
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`)
      .returning();
    
    return trip || undefined;
  }

  async addMealToTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined> {
    // Get the current trip and verify ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // Don't add if recipe is already in meals
    if (trip.meals.includes(recipeId)) {
      return trip;
    }

    // Add the recipe to the meals array
    const updatedMeals = [...trip.meals, recipeId];
    
    // Update the trip in the database (ownership already verified above)
    const [updatedTrip] = await db
      .update(trips)
      .set({ meals: updatedMeals })
      .where(eq(trips.id, tripId))
      .returning();
    
    return updatedTrip;
  }

  async removeMealFromTrip(tripId: number, recipeId: number, userId: string): Promise<Trip | undefined> {
    // Get the current trip and verify ownership
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // Remove the recipe from meals array
    const updatedMeals = trip.meals.filter(id => id !== recipeId);
    
    // Update the trip in the database (ownership already verified above)
    const [updatedTrip] = await db
      .update(trips)
      .set({ meals: updatedMeals })
      .where(eq(trips.id, tripId))
      .returning();
    
    return updatedTrip;
  }

  // Shared Grocery List methods
  async createSharedGroceryList(data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList> {
    // Generate a unique token for sharing (URL-safe random string)
    const token = randomUUID().replace(/-/g, '').substring(0, 32);
    
    const [sharedList] = await db
      .insert(sharedGroceryLists)
      .values({
        token,
        tripId: data.tripId ?? null,
        tripName: data.tripName ?? null,
        items: data.items as any,
        collaborators: data.collaborators,
        userId,
        expiresAt: data.expiresAt ?? null,
      })
      .returning();
    
    return sharedList;
  }

  async getSharedGroceryListByToken(token: string): Promise<SharedGroceryList | undefined> {
    const [sharedList] = await db
      .select()
      .from(sharedGroceryLists)
      .where(eq(sharedGroceryLists.token, token));
    
    // Check if the link has expired
    if (sharedList && sharedList.expiresAt && sharedList.expiresAt < new Date()) {
      return undefined;
    }
    
    return sharedList || undefined;
  }

  async upsertSharedGroceryListByTrip(tripId: number, data: CreateSharedGroceryList, userId: string): Promise<SharedGroceryList> {
    // Delete any existing shared list for this trip (revokes old token)
    await db
      .delete(sharedGroceryLists)
      .where(eq(sharedGroceryLists.tripId, tripId));
    
    // Create a new shared list with a fresh token
    return this.createSharedGroceryList({ ...data, tripId }, userId);
  }

  async getSharedGroceryListByTrip(tripId: number): Promise<SharedGroceryList | undefined> {
    const [sharedList] = await db
      .select()
      .from(sharedGroceryLists)
      .where(eq(sharedGroceryLists.tripId, tripId));
    
    // Check if the link has expired
    if (sharedList && sharedList.expiresAt && sharedList.expiresAt < new Date()) {
      return undefined;
    }
    
    return sharedList || undefined;
  }
}

// Use database storage for persistent data
export const storage = new DatabaseStorage();
