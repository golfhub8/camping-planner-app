import { type User, type UpsertUser, type Recipe, type InsertRecipe, type Trip, type InsertTrip, type UpdateTrip, type SharedGroceryList, type CreateSharedGroceryList, type Campground, type TripMeal, type AddMeal, type TripPackingItem, type AddPackingItem, type UpdatePackingItem, users, recipes, trips, tripMeals, sharedGroceryLists, CAMPING_BASICS } from "@shared/schema";
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
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stripe methods for payment integration
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateStripeSubscriptionId(userId: string, subscriptionId: string): Promise<User>;
  updateProMembershipEndDate(userId: string, endDate: Date | null): Promise<User>;
  updateSubscriptionStatus(userId: string, status: string | null): Promise<User>;
  
  // Usage counter methods for free plan limits
  incrementTripsCount(userId: string): Promise<User>;
  decrementTripsCount(userId: string): Promise<User>;
  incrementGroceryCount(userId: string): Promise<User>;
  decrementGroceryCount(userId: string): Promise<User>;
  
  // Recipe methods
  // Get all recipes for a user (returns newest first)
  getAllRecipes(userId: string): Promise<Recipe[]>;
  
  // Get a single recipe by its ID (with ownership check)
  getRecipeById(id: number, userId: string): Promise<Recipe | undefined>;
  
  // Create a new recipe for a user
  createRecipe(recipe: InsertRecipe, userId: string): Promise<Recipe>;
  
  // Search recipes by title (case-insensitive) for a user
  searchRecipes(query: string, userId: string): Promise<Recipe[]>;
  
  // Update share token for a recipe
  updateRecipeShareToken(recipeId: number, shareToken: string): Promise<void>;
  
  // Get recipe by share token (public access)
  getRecipeByShareToken(shareToken: string): Promise<Recipe | undefined>;
  
  // Delete a recipe (with ownership check)
  deleteRecipe(recipeId: number, userId: string): Promise<boolean>;
  
  // Trip methods
  // Get all trips for a user (returns newest first)
  getAllTrips(userId: string): Promise<Trip[]>;
  
  // Get a single trip by its ID (with ownership check)
  getTripById(id: number, userId: string): Promise<Trip | undefined>;
  
  // Count total trips for a user (authoritative source for free-tier limit enforcement)
  countUserTrips(userId: string): Promise<number>;
  
  // Create a new trip for a user
  createTrip(trip: InsertTrip, userId: string): Promise<Trip>;
  
  // Update an existing trip (with ownership check)
  // All fields in UpdateTrip are optional for partial updates
  updateTrip(tripId: number, updates: UpdateTrip, userId: string): Promise<Trip | undefined>;
  
  // Add a collaborator to a trip (with ownership check)
  addCollaborator(tripId: number, collaborator: string, userId: string): Promise<Trip | undefined>;
  
  // Update cost information for a trip (with ownership check)
  updateTripCost(tripId: number, total: number, userId: string, paidBy?: string): Promise<Trip | undefined>;
  
  // Trip Meal methods (using trip_meals junction table)
  // Get all meals for a trip (with ownership check)
  getTripMeals(tripId: number, userId: string): Promise<import("@shared/schema").TripMeal[]>;
  
  // Add a meal (recipe) to a trip - supports both internal and external recipes
  addMealToTrip(tripId: number, meal: import("@shared/schema").AddMeal, userId: string): Promise<import("@shared/schema").TripMeal | undefined>;
  
  // Remove a meal from a trip by meal ID (with ownership check)
  removeMealFromTrip(tripId: number, mealId: number, userId: string): Promise<boolean>;
  
  // Trip Packing Item methods
  // Get all packing items for a trip (with ownership check)
  getTripPackingItems(tripId: number, userId: string): Promise<import("@shared/schema").TripPackingItem[]>;
  
  // Add a packing item to a trip (with ownership check)
  addPackingItem(tripId: number, item: import("@shared/schema").AddPackingItem, userId: string): Promise<import("@shared/schema").TripPackingItem | undefined>;
  
  // Update a packing item (with ownership check)
  updatePackingItem(tripId: number, itemId: number, updates: import("@shared/schema").UpdatePackingItem, userId: string): Promise<import("@shared/schema").TripPackingItem | undefined>;
  
  // Delete a packing item from a trip (with ownership check)
  deletePackingItem(tripId: number, itemId: number, userId: string): Promise<boolean>;
  
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
  
  // Personal Grocery List methods
  // Add ingredients from a recipe to user's personal grocery list (with merging)
  addIngredientsToPersonalList(userId: string, recipeId: number, recipeTitle: string, ingredients: { name: string; amount?: string }[]): Promise<void>;
  
  // Get all items in user's personal grocery list
  getPersonalGroceryList(userId: string): Promise<import("@shared/schema").PersonalGroceryItemDB[]>;
  
  // Clear all items from user's personal grocery list
  clearPersonalGroceryList(userId: string): Promise<void>;
}

// In-memory storage implementation
// This stores all data in memory (data is lost when server restarts)
// Good for development and prototyping
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private recipes: Map<number, Recipe>;
  private trips: Map<number, Trip>;
  private tripMealsStore: Map<number, TripMeal>; // Store trip meals separately
  private nextRecipeId: number;
  private nextTripId: number;
  private nextTripMealId: number;

  constructor() {
    this.users = new Map();
    this.recipes = new Map();
    this.trips = new Map();
    this.tripMealsStore = new Map();
    this.nextRecipeId = 1;
    this.nextTripId = 1;
    this.nextTripMealId = 1;
  }

  // User methods (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const allUsers = Array.from(this.users.values());
    return allUsers.find(user => user.email === email);
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const allUsers = Array.from(this.users.values());
    return allUsers.find(user => user.stripeCustomerId === stripeCustomerId);
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
      subscriptionStatus: existingUser?.subscriptionStatus ?? null,
      selectedCampingBasics: existingUser?.selectedCampingBasics ?? [],
      tripsCount: existingUser?.tripsCount ?? 0,
      groceryCount: existingUser?.groceryCount ?? 0,
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

  async updateSubscriptionStatus(userId: string, status: string | null): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.subscriptionStatus = status;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  // Usage counter methods for free plan limits
  async incrementTripsCount(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.tripsCount += 1;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async decrementTripsCount(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.tripsCount = Math.max(0, user.tripsCount - 1);
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async incrementGroceryCount(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.groceryCount += 1;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async decrementGroceryCount(userId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.groceryCount = Math.max(0, user.groceryCount - 1);
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  // Recipe methods
  async getAllRecipes(userId: string): Promise<Recipe[]> {
    // Return all non-archived recipes for this user, sorted by creation date (newest first)
    return Array.from(this.recipes.values())
      .filter(recipe => recipe.userId === userId && !recipe.archived)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecipeById(id: number, userId: string): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(id);
    // Only return if user owns this recipe and it's not archived
    if (recipe && recipe.userId === userId && !recipe.archived) {
      return recipe;
    }
    return undefined;
  }

  async createRecipe(insertRecipe: InsertRecipe, userId: string): Promise<Recipe> {
    // Create a new recipe with auto-generated ID, timestamp, userId, and not archived
    const recipe: Recipe = {
      ...insertRecipe,
      imageUrl: insertRecipe.imageUrl ?? null,
      sourceUrl: insertRecipe.sourceUrl ?? null,
      shareToken: null,
      archived: false,
      id: this.nextRecipeId++,
      userId,
      createdAt: new Date(),
    };
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }

  async searchRecipes(query: string, userId: string): Promise<Recipe[]> {
    // Search for non-archived recipes where title contains the query (case-insensitive) for this user
    const lowerQuery = query.toLowerCase();
    return Array.from(this.recipes.values())
      .filter((recipe) => recipe.userId === userId && !recipe.archived && recipe.title.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateRecipeShareToken(recipeId: number, shareToken: string): Promise<void> {
    const recipe = this.recipes.get(recipeId);
    if (recipe) {
      recipe.shareToken = shareToken;
      this.recipes.set(recipeId, recipe);
    }
  }

  async getRecipeByShareToken(shareToken: string): Promise<Recipe | undefined> {
    return Array.from(this.recipes.values())
      .find((recipe) => recipe.shareToken === shareToken);
  }

  async deleteRecipe(recipeId: number, userId: string): Promise<boolean> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe || recipe.userId !== userId) {
      return false;
    }
    // Soft delete: mark as archived instead of removing from storage
    recipe.archived = true;
    this.recipes.set(recipeId, recipe);
    return true;
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

  async countUserTrips(userId: string): Promise<number> {
    // Count total trips for this user (authoritative source for free-tier enforcement)
    return Array.from(this.trips.values())
      .filter(trip => trip.userId === userId)
      .length;
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

  // Get all meals for a trip (with ownership check)
  async getTripMeals(tripId: number, userId: string): Promise<TripMeal[]> {
    // Verify trip ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return [];
    }

    // Get all meals for this trip
    return Array.from(this.tripMealsStore.values())
      .filter(meal => meal.tripId === tripId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Add a meal (recipe) to a trip - supports both internal and external recipes
  async addMealToTrip(tripId: number, meal: AddMeal, userId: string): Promise<TripMeal | undefined> {
    // Verify trip ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return undefined;
    }

    // For internal recipes, check if meal already exists
    if (!meal.isExternal && meal.recipeId) {
      const exists = Array.from(this.tripMealsStore.values()).some(
        m => m.tripId === tripId && m.recipeId === meal.recipeId && !m.isExternal
      );
      if (exists) {
        return undefined; // Already added
      }

      // Get recipe title from recipes map
      const recipe = this.recipes.get(meal.recipeId);
      if (!recipe) {
        return undefined; // Recipe not found
      }

      const newMeal: TripMeal = {
        id: this.nextTripMealId++,
        tripId,
        recipeId: meal.recipeId,
        isExternal: false,
        externalRecipeId: null,
        title: recipe.title,
        sourceUrl: null,
        createdAt: new Date(),
      };
      this.tripMealsStore.set(newMeal.id, newMeal);
      return newMeal;
    }

    // For external recipes
    if (meal.isExternal && meal.externalRecipeId && meal.title && meal.sourceUrl) {
      // Check if external meal already exists
      const exists = Array.from(this.tripMealsStore.values()).some(
        m => m.tripId === tripId && m.externalRecipeId === meal.externalRecipeId && m.isExternal
      );
      if (exists) {
        return undefined; // Already added
      }

      const newMeal: TripMeal = {
        id: this.nextTripMealId++,
        tripId,
        recipeId: null,
        isExternal: true,
        externalRecipeId: meal.externalRecipeId,
        title: meal.title,
        sourceUrl: meal.sourceUrl,
        createdAt: new Date(),
      };
      this.tripMealsStore.set(newMeal.id, newMeal);
      return newMeal;
    }

    return undefined;
  }

  // Remove a meal from a trip by meal ID (with ownership check)
  async removeMealFromTrip(tripId: number, mealId: number, userId: string): Promise<boolean> {
    // Verify trip ownership
    const trip = this.trips.get(tripId);
    if (!trip || trip.userId !== userId) {
      return false;
    }

    // Find and remove the meal
    const meal = this.tripMealsStore.get(mealId);
    if (!meal || meal.tripId !== tripId) {
      return false;
    }

    this.tripMealsStore.delete(mealId);
    return true;
  }

  // Trip Packing Item methods (stub - in-memory not used in production)
  async getTripPackingItems(tripId: number, userId: string): Promise<TripPackingItem[]> {
    return [];
  }

  async addPackingItem(tripId: number, item: AddPackingItem, userId: string): Promise<TripPackingItem | undefined> {
    return undefined;
  }

  async updatePackingItem(tripId: number, itemId: number, updates: UpdatePackingItem, userId: string): Promise<TripPackingItem | undefined> {
    return undefined;
  }

  async deletePackingItem(tripId: number, itemId: number, userId: string): Promise<boolean> {
    return false;
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

  // Personal Grocery List methods
  private personalGroceryItems: Map<string, any[]> = new Map();
  private nextPersonalGroceryId: number = 1;

  async addIngredientsToPersonalList(
    userId: string,
    recipeId: number,
    recipeTitle: string,
    ingredients: { name: string; amount?: string }[]
  ): Promise<void> {
    const userItems = this.personalGroceryItems.get(userId) || [];

    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim();
      const existingItem = userItems.find((item: any) => item.ingredientKey === key);

      if (existingItem) {
        // Merge: add amount, recipeId, and title if not already present
        if (ing.amount && !existingItem.amounts.includes(ing.amount)) {
          existingItem.amounts.push(ing.amount);
        }
        if (!existingItem.recipeIds.includes(recipeId)) {
          existingItem.recipeIds.push(recipeId);
          existingItem.recipeTitles.push(recipeTitle);
        }
      } else {
        // New item
        userItems.push({
          id: this.nextPersonalGroceryId++,
          userId,
          ingredientKey: key,
          displayName: ing.name,
          amounts: ing.amount ? [ing.amount] : [],
          recipeIds: [recipeId],
          recipeTitles: [recipeTitle],
          createdAt: new Date(),
        });
      }
    }

    this.personalGroceryItems.set(userId, userItems);
  }

  async getPersonalGroceryList(userId: string): Promise<any[]> {
    return this.personalGroceryItems.get(userId) || [];
  }

  async clearPersonalGroceryList(userId: string): Promise<void> {
    this.personalGroceryItems.delete(userId);
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Insert or update user on conflict (Replit Auth requirement)
    // Use id (OIDC sub claim) as conflict target - this is the stable unique identifier
    // If user logs in again, update their profile data
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

  async updateSubscriptionStatus(userId: string, status: string | null): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        subscriptionStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // Usage counter methods for free plan limits
  async incrementTripsCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        tripsCount: sql`${users.tripsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async decrementTripsCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        tripsCount: sql`GREATEST(0, ${users.tripsCount} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async incrementGroceryCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        groceryCount: sql`${users.groceryCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async decrementGroceryCount(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        groceryCount: sql`GREATEST(0, ${users.groceryCount} - 1)`,
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
    // Get all non-archived recipes for this user only
    return await db
      .select()
      .from(recipes)
      .where(sql`${recipes.userId} = ${userId} AND ${recipes.archived} = false`)
      .orderBy(desc(recipes.createdAt));
  }

  async getRecipeById(id: number, userId: string): Promise<Recipe | undefined> {
    // Get recipe only if user owns it and it's not archived
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(sql`${recipes.id} = ${id} AND ${recipes.userId} = ${userId} AND ${recipes.archived} = false`);
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
    // Search for non-archived recipes where title contains the query (case-insensitive) for this user
    return await db
      .select()
      .from(recipes)
      .where(sql`LOWER(${recipes.title}) LIKE LOWER(${'%' + query + '%'}) AND ${recipes.userId} = ${userId} AND ${recipes.archived} = false`)
      .orderBy(desc(recipes.createdAt));
  }

  async updateRecipeShareToken(recipeId: number, shareToken: string): Promise<void> {
    // Update the share token for a recipe
    await db
      .update(recipes)
      .set({ shareToken })
      .where(eq(recipes.id, recipeId));
  }

  async getRecipeByShareToken(shareToken: string): Promise<Recipe | undefined> {
    // Get recipe by share token (public access - no ownership check)
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.shareToken, shareToken));
    return recipe || undefined;
  }

  async deleteRecipe(recipeId: number, userId: string): Promise<boolean> {
    // Soft delete: mark recipe as archived instead of deleting
    const result = await db
      .update(recipes)
      .set({ archived: true })
      .where(sql`${recipes.id} = ${recipeId} AND ${recipes.userId} = ${userId}`)
      .returning();
    return result.length > 0;
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

  async countUserTrips(userId: string): Promise<number> {
    // Count total trips for this user (authoritative source for free-tier enforcement)
    const result = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(trips)
      .where(eq(trips.userId, userId));
    return result[0]?.count || 0;
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

  // Get all meals for a trip (with ownership check)
  async getTripMeals(tripId: number, userId: string): Promise<TripMeal[]> {
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return [];
    }

    // Get all meals for this trip
    const meals = await db
      .select()
      .from(tripMeals)
      .where(eq(tripMeals.tripId, tripId))
      .orderBy(desc(tripMeals.createdAt));
    
    return meals;
  }

  // Add a meal (recipe) to a trip - supports both internal and external recipes
  async addMealToTrip(tripId: number, meal: AddMeal, userId: string): Promise<TripMeal | undefined> {
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // For internal recipes
    if (!meal.isExternal && meal.recipeId) {
      // Get recipe title from recipes table
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, meal.recipeId));
      
      if (!recipe) {
        return undefined; // Recipe not found
      }

      // Check if meal already exists
      const [existing] = await db
        .select()
        .from(tripMeals)
        .where(sql`${tripMeals.tripId} = ${tripId} AND ${tripMeals.recipeId} = ${meal.recipeId} AND ${tripMeals.isExternal} = false`);
      
      if (existing) {
        return undefined; // Already added
      }

      // Insert new meal
      const [newMeal] = await db
        .insert(tripMeals)
        .values({
          tripId,
          recipeId: meal.recipeId,
          isExternal: false,
          externalRecipeId: null,
          title: recipe.title,
          sourceUrl: null,
        })
        .returning();
      
      return newMeal;
    }

    // For external recipes
    if (meal.isExternal && meal.externalRecipeId && meal.title && meal.sourceUrl) {
      // Check if external meal already exists
      const [existing] = await db
        .select()
        .from(tripMeals)
        .where(sql`${tripMeals.tripId} = ${tripId} AND ${tripMeals.externalRecipeId} = ${meal.externalRecipeId} AND ${tripMeals.isExternal} = true`);
      
      if (existing) {
        return undefined; // Already added
      }

      // Insert new external meal
      const [newMeal] = await db
        .insert(tripMeals)
        .values({
          tripId,
          recipeId: null,
          isExternal: true,
          externalRecipeId: meal.externalRecipeId,
          title: meal.title,
          sourceUrl: meal.sourceUrl,
        })
        .returning();
      
      return newMeal;
    }

    return undefined;
  }

  // Remove a meal from a trip by meal ID (with ownership check)
  async removeMealFromTrip(tripId: number, mealId: number, userId: string): Promise<boolean> {
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return false;
    }

    // Delete the meal
    const result = await db
      .delete(tripMeals)
      .where(sql`${tripMeals.id} = ${mealId} AND ${tripMeals.tripId} = ${tripId}`)
      .returning();
    
    return result.length > 0;
  }

  // Trip Packing Item methods
  async getTripPackingItems(tripId: number, userId: string): Promise<TripPackingItem[]> {
    const { tripPackingItems } = await import("@shared/schema");
    
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return [];
    }

    // Get all packing items for this trip
    const items = await db
      .select()
      .from(tripPackingItems)
      .where(eq(tripPackingItems.tripId, tripId))
      .orderBy(tripPackingItems.createdAt);
    
    return items;
  }

  async addPackingItem(tripId: number, item: AddPackingItem, userId: string): Promise<TripPackingItem | undefined> {
    const { tripPackingItems } = await import("@shared/schema");
    
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // Add the packing item
    const [newItem] = await db
      .insert(tripPackingItems)
      .values({
        tripId,
        name: item.name,
        category: item.category || null,
      })
      .returning();
    
    return newItem;
  }

  async updatePackingItem(tripId: number, itemId: number, updates: UpdatePackingItem, userId: string): Promise<TripPackingItem | undefined> {
    const { tripPackingItems } = await import("@shared/schema");
    
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return undefined;
    }

    // Update the packing item
    const [updatedItem] = await db
      .update(tripPackingItems)
      .set(updates)
      .where(sql`${tripPackingItems.id} = ${itemId} AND ${tripPackingItems.tripId} = ${tripId}`)
      .returning();
    
    return updatedItem;
  }

  async deletePackingItem(tripId: number, itemId: number, userId: string): Promise<boolean> {
    const { tripPackingItems } = await import("@shared/schema");
    
    // Verify trip ownership first
    const [trip] = await db
      .select()
      .from(trips)
      .where(sql`${trips.id} = ${tripId} AND ${trips.userId} = ${userId}`);
    
    if (!trip) {
      return false;
    }

    // Delete the packing item
    const result = await db
      .delete(tripPackingItems)
      .where(sql`${tripPackingItems.id} = ${itemId} AND ${tripPackingItems.tripId} = ${tripId}`)
      .returning();
    
    return result.length > 0;
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

  // Personal Grocery List methods
  async addIngredientsToPersonalList(
    userId: string,
    recipeId: number,
    recipeTitle: string,
    ingredients: { name: string; amount?: string }[]
  ): Promise<void> {
    const { personalGroceryItems } = await import("@shared/schema");
    
    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim();
      
      // Use upsert with onConflict to handle merging safely
      // This relies on the unique index on (userId, ingredientKey)
      await db
        .insert(personalGroceryItems)
        .values({
          userId,
          ingredientKey: key,
          displayName: ing.name,
          amounts: ing.amount ? [ing.amount] : [],
          recipeIds: [recipeId],
          recipeTitles: [recipeTitle],
        })
        .onConflictDoUpdate({
          target: [personalGroceryItems.userId, personalGroceryItems.ingredientKey],
          set: {
            amounts: sql`${personalGroceryItems.amounts} || ARRAY[${ing.amount || ''}]::text[]`,
            recipeIds: sql`${personalGroceryItems.recipeIds} || ARRAY[${recipeId}]::integer[]`,
            recipeTitles: sql`${personalGroceryItems.recipeTitles} || ARRAY[${recipeTitle}]::text[]`,
          },
        });
    }
  }

  async getPersonalGroceryList(userId: string): Promise<any[]> {
    const { personalGroceryItems } = await import("@shared/schema");
    
    const items = await db
      .select()
      .from(personalGroceryItems)
      .where(eq(personalGroceryItems.userId, userId));
    
    return items;
  }

  async clearPersonalGroceryList(userId: string): Promise<void> {
    const { personalGroceryItems } = await import("@shared/schema");
    
    await db
      .delete(personalGroceryItems)
      .where(eq(personalGroceryItems.userId, userId));
  }
}

// Use database storage for persistent data
export const storage = new DatabaseStorage();
