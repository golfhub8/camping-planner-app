import { type User, type UpsertUser, type Recipe, type InsertRecipe, type Trip, type InsertTrip, type UpdateTrip, type SharedGroceryList, type CreateSharedGroceryList, type Campground, users, recipes, trips, sharedGroceryLists, CAMPING_BASICS } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

// Helper to validate camping basic ID
// Throws an error if the ID is not in the CAMPING_BASICS array
function validateCampingBasicId(basicId: string): void {
  const isValid = CAMPING_BASICS.some(basic => basic.id === basicId);
  if (!isValid) {
    throw new Error(`Invalid camping basic ID: ${basicId}. Must be one of the predefined camping basics.`);
  }
}

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
  
  // Update an existing trip (with ownership check)
  // All fields in UpdateTrip are optional for partial updates
  updateTrip(tripId: number, updates: UpdateTrip, userId: string): Promise<Trip | undefined>;
  
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
  
  // Campground methods (in-memory only - not persisted to database)
  // Search for campgrounds by location query
  searchCampgrounds(query: string): Promise<Campground[]>;
  
  // Camping Basics methods
  // Get list of camping basic IDs that the user has selected
  getCampingBasics(userId: string): Promise<string[]>;
  
  // Add a camping basic to user's selection (if not already added)
  addCampingBasic(userId: string, basicId: string): Promise<string[]>;
  
  // Remove a camping basic from user's selection
  removeCampingBasic(userId: string, basicId: string): Promise<string[]>;
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
      selectedCampingBasics: existingUser?.selectedCampingBasics ?? [],
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
      // Use explicit null check to allow valid 0 coordinates (equator/prime meridian)
      lat: insertTrip.lat !== null && insertTrip.lat !== undefined ? insertTrip.lat.toString() : null,
      lng: insertTrip.lng !== null && insertTrip.lng !== undefined ? insertTrip.lng.toString() : null,
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

  async updateTrip(tripId: number, updates: UpdateTrip, userId: string): Promise<Trip | undefined> {
    // Find the trip and verify ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return undefined;
    }

    // Apply updates (only update fields that are provided)
    if (updates.name !== undefined) trip.name = updates.name;
    if (updates.location !== undefined) trip.location = updates.location;
    if (updates.startDate !== undefined) trip.startDate = updates.startDate;
    if (updates.endDate !== undefined) trip.endDate = updates.endDate;
    // Handle coordinates: check if the property exists in updates (even if value is undefined)
    // This allows clearing coordinates by sending null/undefined values
    // Use explicit null check instead of truthiness to allow valid 0 coordinates (equator/prime meridian)
    if ("lat" in updates) trip.lat = updates.lat !== null && updates.lat !== undefined ? updates.lat.toString() : null;
    if ("lng" in updates) trip.lng = updates.lng !== null && updates.lng !== undefined ? updates.lng.toString() : null;

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

  // Campground search methods (in-memory mock data only)
  // Mock campground database for demonstration
  private mockCampgrounds: Campground[] = [
    // Pacific Northwest Campgrounds
    {
      id: "goldstream",
      name: "Goldstream Provincial Park",
      type: "Provincial Park",
      location: "Victoria, BC",
      latitude: 48.467,
      longitude: -123.562,
      description: "Beautiful old-growth forest with hiking trails and salmon spawning in fall"
    },
    {
      id: "french-beach",
      name: "French Beach Provincial Park",
      type: "Provincial Park",
      location: "Sooke, BC",
      latitude: 48.371,
      longitude: -123.934,
      description: "Oceanfront camping with spectacular sunsets and whale watching"
    },
    {
      id: "rathtrevor",
      name: "Rathtrevor Beach Provincial Park",
      type: "Provincial Park",
      location: "Parksville, BC",
      latitude: 49.311,
      longitude: -124.279,
      description: "Family-friendly beach camping with warm waters and sandy shores"
    },
    {
      id: "miracle-beach",
      name: "Miracle Beach Provincial Park",
      type: "Provincial Park",
      location: "Courtenay, BC",
      latitude: 49.854,
      longitude: -125.118,
      description: "Sandy beach with nature programs and great swimming"
    },
    {
      id: "olympic-np",
      name: "Olympic National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 47.802,
      longitude: -123.604,
      description: "Diverse ecosystems from mountains to rainforests to beaches"
    },
    {
      id: "mount-rainier",
      name: "Mount Rainier National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 46.853,
      longitude: -121.760,
      description: "Iconic mountain with alpine meadows and old-growth forests"
    },
    {
      id: "north-cascades",
      name: "North Cascades National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 48.717,
      longitude: -121.298,
      description: "Rugged mountain wilderness with stunning alpine scenery"
    },
    {
      id: "deception-pass",
      name: "Deception Pass State Park",
      type: "State Park",
      location: "Washington State",
      latitude: 48.405,
      longitude: -122.647,
      description: "Dramatic bridge views and forested trails on Whidbey Island"
    },
  ];

  async searchCampgrounds(query: string): Promise<Campground[]> {
    // Simple case-insensitive search across name and location
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
      // Return all campgrounds if no query
      return this.mockCampgrounds;
    }
    
    // Filter campgrounds that match the query in name or location
    return this.mockCampgrounds.filter((campground) =>
      campground.name.toLowerCase().includes(lowerQuery) ||
      campground.location.toLowerCase().includes(lowerQuery) ||
      (campground.description && campground.description.toLowerCase().includes(lowerQuery))
    );
  }

  // Camping Basics methods
  async getCampingBasics(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user.selectedCampingBasics || [];
  }

  async addCampingBasic(userId: string, basicId: string): Promise<string[]> {
    // Validate that the basicId is a valid CAMPING_BASICS ID
    validateCampingBasicId(basicId);
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Don't add if already exists
    if (user.selectedCampingBasics.includes(basicId)) {
      return user.selectedCampingBasics;
    }
    
    // Add the basic ID to the array
    user.selectedCampingBasics.push(basicId);
    user.updatedAt = new Date();
    this.users.set(userId, user);
    
    return user.selectedCampingBasics;
  }

  async removeCampingBasic(userId: string, basicId: string): Promise<string[]> {
    // Validate that the basicId is a valid CAMPING_BASICS ID
    validateCampingBasicId(basicId);
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Remove the basic ID from the array
    user.selectedCampingBasics = user.selectedCampingBasics.filter(id => id !== basicId);
    user.updatedAt = new Date();
    this.users.set(userId, user);
    
    return user.selectedCampingBasics;
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
    // Convert numeric lat/lng to strings for database storage
    const [trip] = await db
      .insert(trips)
      .values({ 
        name: insertTrip.name,
        location: insertTrip.location,
        // Use explicit null check to allow valid 0 coordinates (equator/prime meridian)
        lat: insertTrip.lat !== null && insertTrip.lat !== undefined ? insertTrip.lat.toString() : null,
        lng: insertTrip.lng !== null && insertTrip.lng !== undefined ? insertTrip.lng.toString() : null,
        startDate: insertTrip.startDate,
        endDate: insertTrip.endDate,
        userId 
      })
      .returning();
    return trip;
  }

  async updateTrip(tripId: number, updates: UpdateTrip, userId: string): Promise<Trip | undefined> {
    // Build the update object with only the fields that were provided
    const updateData: Partial<{
      name: string;
      location: string;
      lat: string | null;
      lng: string | null;
      startDate: Date;
      endDate: Date;
    }> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.startDate !== undefined) updateData.startDate = updates.startDate;
    if (updates.endDate !== undefined) updateData.endDate = updates.endDate;
    // Handle coordinates: check if the property exists in updates (even if value is undefined)
    // This allows clearing coordinates by sending null/undefined values
    // Use explicit null check instead of optional chaining to allow valid 0 coordinates (equator/prime meridian)
    if ("lat" in updates) updateData.lat = updates.lat !== null && updates.lat !== undefined ? updates.lat.toString() : null;
    if ("lng" in updates) updateData.lng = updates.lng !== null && updates.lng !== undefined ? updates.lng.toString() : null;

    // If no fields to update, just return the existing trip
    if (Object.keys(updateData).length === 0) {
      const trip = await this.getTripById(tripId, userId);
      return trip;
    }

    // Update trip only if user owns it
    const [trip] = await db
      .update(trips)
      .set(updateData)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`)
      .returning();

    return trip || undefined;
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

  // Campground search methods (in-memory mock data only - not persisted to database)
  // Mock campground database for demonstration
  private mockCampgrounds: Campground[] = [
    // Pacific Northwest Campgrounds
    {
      id: "goldstream",
      name: "Goldstream Provincial Park",
      type: "Provincial Park",
      location: "Victoria, BC",
      latitude: 48.467,
      longitude: -123.562,
      description: "Beautiful old-growth forest with hiking trails and salmon spawning in fall"
    },
    {
      id: "french-beach",
      name: "French Beach Provincial Park",
      type: "Provincial Park",
      location: "Sooke, BC",
      latitude: 48.371,
      longitude: -123.934,
      description: "Oceanfront camping with spectacular sunsets and whale watching"
    },
    {
      id: "rathtrevor",
      name: "Rathtrevor Beach Provincial Park",
      type: "Provincial Park",
      location: "Parksville, BC",
      latitude: 49.311,
      longitude: -124.279,
      description: "Family-friendly beach camping with warm waters and sandy shores"
    },
    {
      id: "miracle-beach",
      name: "Miracle Beach Provincial Park",
      type: "Provincial Park",
      location: "Courtenay, BC",
      latitude: 49.854,
      longitude: -125.118,
      description: "Sandy beach with nature programs and great swimming"
    },
    {
      id: "olympic-np",
      name: "Olympic National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 47.802,
      longitude: -123.604,
      description: "Diverse ecosystems from mountains to rainforests to beaches"
    },
    {
      id: "mount-rainier",
      name: "Mount Rainier National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 46.853,
      longitude: -121.760,
      description: "Iconic mountain with alpine meadows and old-growth forests"
    },
    {
      id: "north-cascades",
      name: "North Cascades National Park",
      type: "National Park",
      location: "Washington State",
      latitude: 48.717,
      longitude: -121.298,
      description: "Rugged mountain wilderness with stunning alpine scenery"
    },
    {
      id: "deception-pass",
      name: "Deception Pass State Park",
      type: "State Park",
      location: "Washington State",
      latitude: 48.405,
      longitude: -122.647,
      description: "Dramatic bridge views and forested trails on Whidbey Island"
    },
  ];

  async searchCampgrounds(query: string): Promise<Campground[]> {
    // Simple case-insensitive search across name and location
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) {
      // Return all campgrounds if no query
      return this.mockCampgrounds;
    }
    
    // Filter campgrounds that match the query in name or location
    return this.mockCampgrounds.filter((campground) =>
      campground.name.toLowerCase().includes(lowerQuery) ||
      campground.location.toLowerCase().includes(lowerQuery) ||
      (campground.description && campground.description.toLowerCase().includes(lowerQuery))
    );
  }

  // Camping Basics methods
  async getCampingBasics(userId: string): Promise<string[]> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }
    return user.selectedCampingBasics || [];
  }

  async addCampingBasic(userId: string, basicId: string): Promise<string[]> {
    // Validate that the basicId is a valid CAMPING_BASICS ID
    validateCampingBasicId(basicId);
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }
    
    // Don't add if already exists
    if (user.selectedCampingBasics.includes(basicId)) {
      return user.selectedCampingBasics;
    }
    
    // Add the basic ID to the array
    const updatedBasics = [...user.selectedCampingBasics, basicId];
    await db
      .update(users)
      .set({ 
        selectedCampingBasics: updatedBasics,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    
    return updatedBasics;
  }

  async removeCampingBasic(userId: string, basicId: string): Promise<string[]> {
    // Validate that the basicId is a valid CAMPING_BASICS ID
    validateCampingBasicId(basicId);
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }
    
    // Remove the basic ID from the array
    const updatedBasics = user.selectedCampingBasics.filter(id => id !== basicId);
    await db
      .update(users)
      .set({ 
        selectedCampingBasics: updatedBasics,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    
    return updatedBasics;
  }
}

// Use database storage for persistent data
export const storage = new DatabaseStorage();
