import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, generateGroceryListSchema, insertTripSchema, addCollaboratorSchema, addTripCostSchema, addMealSchema, createSharedGroceryListSchema, type GroceryItem, type GroceryCategory, type Recipe } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";
import Stripe from "stripe";

// Initialize Stripe client
// Reference: blueprint:javascript_stripe
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication middleware (Replit Auth integration)
  await setupAuth(app);

  // Authentication Routes
  
  // GET /api/auth/user
  // Returns the currently logged in user
  // Protected route - requires authentication
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Recipe Routes
  // All routes are prefixed with /api
  // All recipe routes require authentication
  
  // GET /api/recipes
  // Returns all recipes for the logged in user, sorted by newest first
  // Protected route - requires authentication
  app.get("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getAllRecipes(userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  // GET /api/recipes/:id
  // Returns a single recipe by ID (only if user owns it)
  // Protected route - requires authentication
  app.get("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate that ID is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid recipe ID" });
      }

      const recipe = await storage.getRecipeById(id, userId);
      
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json(recipe);
    } catch (error) {
      console.error("Error fetching recipe:", error);
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });

  // POST /api/recipes
  // Creates a new recipe for the logged in user
  // Body: { title: string, ingredients: string[], steps: string }
  // Protected route - requires authentication
  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body against our schema
      const validatedData = insertRecipeSchema.parse(req.body);
      
      // Create the recipe in storage (with userId)
      const recipe = await storage.createRecipe(validatedData, userId);
      
      // Return the created recipe with 201 status
      res.status(201).json(recipe);
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid recipe data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating recipe:", error);
      res.status(500).json({ error: "Failed to create recipe" });
    }
  });

  // GET /api/search
  // Searches recipes by title for the logged in user
  // Query parameter: q (the search query)
  // Example: /api/search?q=chili
  // Protected route - requires authentication
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      const userId = req.user.claims.sub;
      
      // Validate that query exists
      if (!query || query.trim() === "") {
        return res.status(400).json({ error: "Search query is required" });
      }

      const recipes = await storage.searchRecipes(query, userId);
      res.json(recipes);
    } catch (error) {
      console.error("Error searching recipes:", error);
      res.status(500).json({ error: "Failed to search recipes" });
    }
  });

  // Grocery List Routes
  
  // Helper function to categorize ingredients
  // Analyzes ingredient text to determine which category it belongs to
  function categorizeIngredient(ingredient: string): GroceryCategory {
    const lower = ingredient.toLowerCase();
    
    // Produce keywords
    if (/(tomato|lettuce|onion|pepper|carrot|potato|celery|garlic|mushroom|broccoli|spinach|cucumber|zucchini|corn|pea|bean|apple|banana|orange|lemon|lime|berry|fruit|vegetable)/i.test(lower)) {
      return "Produce";
    }
    
    // Dairy keywords
    if (/(milk|cheese|butter|cream|yogurt|sour cream|cottage cheese|cheddar|mozzarella|parmesan)/i.test(lower)) {
      return "Dairy";
    }
    
    // Meat keywords
    if (/(beef|chicken|pork|turkey|fish|salmon|tuna|bacon|sausage|ham|steak|ground beef|meat)/i.test(lower)) {
      return "Meat";
    }
    
    // Camping Gear keywords
    if (/(foil|paper|plate|cup|napkin|utensil|fork|knife|spoon|lighter|match|firewood|charcoal|grill)/i.test(lower)) {
      return "Camping Gear";
    }
    
    // Default to Pantry for everything else (spices, canned goods, oils, etc.)
    return "Pantry";
  }
  
  // POST /api/grocery/generate
  // Generates a grocery list from selected recipes
  // Body: { recipeIds: number[] }
  // Returns: { items: GroceryItem[] } grouped by category
  // Protected route - requires authentication
  app.post("/api/grocery/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body
      const { recipeIds } = generateGroceryListSchema.parse(req.body);
      
      // Fetch all selected recipes (user can only access their own recipes)
      const recipes = await Promise.all(
        recipeIds.map(id => storage.getRecipeById(id, userId))
      );
      
      // Filter out any null recipes (in case some IDs don't exist)
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.status(404).json({ error: "No valid recipes found" });
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        // Find the original casing from the first occurrence
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));
      
      // Group by category
      const grouped: Record<GroceryCategory, GroceryItem[]> = {
        "Produce": [],
        "Dairy": [],
        "Meat": [],
        "Pantry": [],
        "Camping Gear": [],
      };
      
      groceryItems.forEach(item => {
        grouped[item.category].push(item);
      });
      
      res.json({ items: groceryItems, grouped });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error generating grocery list:", error);
      res.status(500).json({ error: "Failed to generate grocery list" });
    }
  });

  // POST /api/grocery/share
  // Creates a shareable grocery list with a unique token
  // Body: { items: GroceryItem[], tripId?: number, tripName?: string, collaborators?: string[] }
  // Returns: { token: string, shareUrl: string }
  // Protected route - requires authentication
  app.post("/api/grocery/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body
      const data = createSharedGroceryListSchema.parse(req.body);
      
      // Create the shared grocery list
      const sharedList = await storage.createSharedGroceryList(data, userId);
      
      // Generate the full shareable URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;
      
      res.json({ 
        token: sharedList.token,
        shareUrl,
        id: sharedList.id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating shared grocery list:", error);
      res.status(500).json({ error: "Failed to create shared list" });
    }
  });

  // GET /api/grocery/shared/:token
  // Retrieves a shared grocery list by its token
  // Public route - no authentication required
  app.get("/api/grocery/shared/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      
      // Retrieve the shared list
      const sharedList = await storage.getSharedGroceryListByToken(token);
      
      if (!sharedList) {
        return res.status(404).json({ error: "Shared list not found or expired" });
      }
      
      res.json(sharedList);
    } catch (error) {
      console.error("Error fetching shared grocery list:", error);
      res.status(500).json({ error: "Failed to fetch shared list" });
    }
  });

  // Trip Routes
  
  // GET /api/trips
  // Returns all trips for the logged in user, sorted by start date (newest first)
  // Protected route - requires authentication
  app.get("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const trips = await storage.getAllTrips(userId);
      res.json(trips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  // GET /api/trips/:id
  // Returns a single trip by ID with all details (only if user owns it)
  // Protected route - requires authentication
  app.get("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate that ID is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      const trip = await storage.getTripById(id, userId);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(trip);
    } catch (error) {
      console.error("Error fetching trip:", error);
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  // POST /api/trips
  // Creates a new trip for the logged in user
  // Body: { name: string, location: string, startDate: Date, endDate: Date }
  // Protected route - requires authentication
  app.post("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body against our schema
      const validatedData = insertTripSchema.parse(req.body);
      
      // Create the trip in storage (with userId)
      const trip = await storage.createTrip(validatedData, userId);
      
      // Return the created trip with 201 status
      res.status(201).json(trip);
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: error.errors 
        });
      }
      
      console.error("Error creating trip:", error);
      res.status(500).json({ error: "Failed to create trip" });
    }
  });

  // POST /api/trips/:id/collaborators
  // Add a collaborator to a trip
  // Body: { collaborator: string }
  // The collaborator string will be normalized (trimmed, lowercased) before storing
  // Protected route - requires authentication
  app.post("/api/trips/:id/collaborators", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body
      const { collaborator } = addCollaboratorSchema.parse(req.body);
      
      // Add the collaborator to the trip (with ownership check)
      const updatedTrip = await storage.addCollaborator(id, collaborator, userId);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid collaborator data", 
          details: error.errors 
        });
      }
      
      console.error("Error adding collaborator:", error);
      res.status(500).json({ error: "Failed to add collaborator" });
    }
  });

  // POST /api/trips/:id/cost
  // Update cost information for a trip
  // Body: { total: number, paidBy?: string }
  // The total will be stored with 2 decimal places
  // Protected route - requires authentication
  app.post("/api/trips/:id/cost", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body
      const validatedData = addTripCostSchema.parse(req.body);
      
      // Convert to number if it was a string
      const total = typeof validatedData.total === 'string' 
        ? parseFloat(validatedData.total) 
        : validatedData.total;
      
      // Update the trip cost (with ownership check)
      const updatedTrip = await storage.updateTripCost(id, total, userId, validatedData.paidBy);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid cost data", 
          details: error.errors 
        });
      }
      
      console.error("Error updating trip cost:", error);
      res.status(500).json({ error: "Failed to update trip cost" });
    }
  });

  // POST /api/trips/:id/meals
  // Add a recipe (meal) to a trip
  // Body: { recipeId: number }
  // Protected route - requires authentication
  app.post("/api/trips/:id/meals", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Validate the request body
      const { recipeId } = addMealSchema.parse(req.body);

      // Check if recipe exists and user owns it
      const recipe = await storage.getRecipeById(recipeId, userId);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      // Add the meal to the trip (with ownership check)
      const updatedTrip = await storage.addMealToTrip(tripId, recipeId, userId);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid meal data", 
          details: error.errors 
        });
      }
      
      console.error("Error adding meal to trip:", error);
      res.status(500).json({ error: "Failed to add meal to trip" });
    }
  });

  // DELETE /api/trips/:id/meals/:recipeId
  // Remove a recipe (meal) from a trip
  // Protected route - requires authentication
  app.delete("/api/trips/:id/meals/:recipeId", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const recipeId = parseInt(req.params.recipeId);
      const userId = req.user.claims.sub;
      
      // Validate IDs
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }
      if (isNaN(recipeId)) {
        return res.status(400).json({ error: "Invalid recipe ID" });
      }

      // Remove the meal from the trip (with ownership check)
      const updatedTrip = await storage.removeMealFromTrip(tripId, recipeId, userId);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      res.json(updatedTrip);
    } catch (error) {
      console.error("Error removing meal from trip:", error);
      res.status(500).json({ error: "Failed to remove meal from trip" });
    }
  });

  // GET /api/trips/:id/grocery
  // Generate a grocery list from all recipes in a trip
  // Returns the same format as /api/grocery/generate
  // Protected route - requires authentication
  app.get("/api/trips/:id/grocery", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Get the trip (user can only access their own trips)
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Check if trip has any meals
      if (trip.meals.length === 0) {
        return res.json({ items: [], grouped: {
          "Produce": [],
          "Dairy": [],
          "Meat": [],
          "Pantry": [],
          "Camping Gear": [],
        }});
      }

      // Fetch all recipes for the trip's meals (user can only access their own recipes)
      const recipes = await Promise.all(
        trip.meals.map(id => storage.getRecipeById(id, userId))
      );
      
      // Filter out any null recipes (in case some IDs don't exist)
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.json({ items: [], grouped: {
          "Produce": [],
          "Dairy": [],
          "Meat": [],
          "Pantry": [],
          "Camping Gear": [],
        }});
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        // Find the original casing from the first occurrence
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));
      
      // Group by category
      const grouped: Record<GroceryCategory, GroceryItem[]> = {
        "Produce": [],
        "Dairy": [],
        "Meat": [],
        "Pantry": [],
        "Camping Gear": [],
      };
      
      groceryItems.forEach(item => {
        grouped[item.category].push(item);
      });
      
      res.json({ items: groceryItems, grouped });
    } catch (error) {
      console.error("Error generating trip grocery list:", error);
      res.status(500).json({ error: "Failed to generate grocery list" });
    }
  });

  // GET /api/trips/:id/share
  // Get the current shareable link for a trip's grocery list (if one exists)
  // Protected route - requires authentication and trip ownership
  app.get("/api/trips/:id/share", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Verify trip ownership
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Get existing share link for this trip
      const sharedList = await storage.getSharedGroceryListByTrip(tripId);
      
      if (!sharedList) {
        return res.status(404).json({ error: "No share link exists for this trip" });
      }

      // Build the full share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;

      // Count items in the shared list
      const items = sharedList.items as any[];
      const itemCount = Array.isArray(items) ? items.length : 0;

      res.json({ 
        token: sharedList.token, 
        shareUrl,
        tripName: sharedList.tripName || trip.name,
        itemCount,
      });
    } catch (error) {
      console.error("Error fetching trip share link:", error);
      res.status(500).json({ error: "Failed to fetch share link" });
    }
  });

  // POST /api/trips/:id/share
  // Create or update a shareable link for a trip's grocery list
  // This generates the grocery list from the trip's meals and creates a public share link
  // Protected route - requires authentication and trip ownership
  app.post("/api/trips/:id/share", isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Validate trip ID
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }

      // Get the trip (user can only access their own trips)
      const trip = await storage.getTripById(tripId, userId);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Check if trip has any meals
      if (trip.meals.length === 0) {
        return res.status(400).json({ error: "Cannot share grocery list - trip has no meals" });
      }

      // Fetch all recipes for the trip's meals
      const recipes = await Promise.all(
        trip.meals.map(id => storage.getRecipeById(id, userId))
      );
      
      // Filter out any null recipes
      const validRecipes = recipes.filter((r): r is Recipe => r !== null && r !== undefined);
      
      if (validRecipes.length === 0) {
        return res.status(400).json({ error: "Cannot share grocery list - no valid recipes found" });
      }
      
      // Collect all ingredients from selected recipes
      const allIngredients: string[] = [];
      validRecipes.forEach(recipe => {
        allIngredients.push(...recipe.ingredients);
      });
      
      // Normalize and deduplicate ingredients (case-insensitive)
      const uniqueIngredients = Array.from(
        new Set(allIngredients.map(i => i.trim().toLowerCase()))
      ).map(i => {
        return allIngredients.find(orig => orig.trim().toLowerCase() === i) || i;
      });
      
      // Categorize each ingredient and create GroceryItem objects
      const groceryItems: GroceryItem[] = uniqueIngredients.map(ingredient => ({
        name: ingredient,
        category: categorizeIngredient(ingredient),
        checked: false,
      }));

      // Create or update the shared grocery list for this trip
      const sharedList = await storage.upsertSharedGroceryListByTrip(tripId, {
        tripId,
        tripName: trip.name,
        items: groceryItems,
        collaborators: trip.collaborators || [],
      }, userId);

      // Build the full share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedList.token}`;

      res.json({ 
        token: sharedList.token, 
        shareUrl,
        tripName: trip.name,
        itemCount: groceryItems.length,
      });
    } catch (error) {
      console.error("Error creating trip share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  // Stripe Payment Routes
  // Reference: blueprint:javascript_stripe

  // POST /api/billing/create-checkout-session
  // Create a Stripe Checkout session for one-time lifetime access purchase
  // Checkout Sessions are more secure and handle the entire payment flow
  // Protected route - requires authentication
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Build success and cancel URLs
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/printables?payment=success`;
      const cancelUrl = `${baseUrl}/checkout?canceled=true`;

      // Create checkout session for one-time payment
      // SECURITY: Amount is set in Stripe Dashboard, not passed from client
      const session = await stripe.checkout.sessions.create({
        mode: "payment", // One-time payment
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Lifetime Printables Access",
                description: "Unlimited access to all camping planners and printables",
              },
              unit_amount: 2999, // $29.99 in cents
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId, // Pass user ID to identify them in webhook
        customer_email: user.email || undefined,
        metadata: {
          app_user_id: userId,
          purchase_type: "lifetime_printables",
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Unable to create checkout session: " + error.message });
    }
  });

  // POST /api/billing/create-subscription-checkout
  // Create a Stripe Checkout session for monthly subscription
  // Protected route - requires authentication
  app.post("/api/billing/create-subscription-checkout", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user already has an active subscription
      if (user.isSubscriber && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
        return res.status(400).json({ 
          error: "You already have an active subscription",
          subscriptionEndDate: user.subscriptionEndDate
        });
      }

      // Build success and cancel URLs
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/printables?subscription=success`;
      const cancelUrl = `${baseUrl}/subscribe?canceled=true`;

      // Create checkout session for subscription
      // Use price_data for inline pricing or price ID if configured
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Monthly Printables Subscription",
                description: "Unlimited access to all camping planners and printables",
              },
              unit_amount: 999, // $9.99 in cents
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: userId,
        customer_email: user.email || undefined,
        metadata: {
          app_user_id: userId,
          purchase_type: "subscription_printables",
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ error: "Unable to create subscription checkout: " + error.message });
    }
  });

  // POST /api/stripe/webhook
  // Stripe webhook handler for payment events
  // This endpoint is called by Stripe when payment events occur
  // NO authentication middleware - Stripe verifies using webhook signature
  // IMPORTANT: This route MUST use raw body for signature verification
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!stripe) {
      return res.status(503).send("Stripe not configured");
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return res.status(400).send("No signature");
    }

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).send("Webhook secret not configured");
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id || session.metadata?.app_user_id;

          if (!userId) {
            console.error("No user ID in checkout session");
            break;
          }

          const purchaseType = session.metadata?.purchase_type;

          if (purchaseType === 'lifetime_printables') {
            // Grant lifetime access
            await storage.grantLifetimePrintableAccess(userId);
            console.log(`Granted lifetime access to user ${userId}`);
          } else if (purchaseType === 'subscription_printables') {
            // Handle subscription - save customer and subscription IDs
            if (session.customer && session.subscription) {
              await storage.updateStripeCustomerId(userId, session.customer as string);
              await storage.updateStripeSubscriptionId(userId, session.subscription as string);
              
              // Mark as subscriber with end date 1 month from now
              const endDate = new Date();
              endDate.setMonth(endDate.getMonth() + 1);
              await storage.updateSubscriptionStatus(userId, true, endDate);
              
              console.log(`Activated subscription for user ${userId}`);
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          
          // Find user by Stripe subscription ID
          const userId = subscription.metadata?.app_user_id;
          if (!userId) {
            console.error("No user ID in subscription metadata");
            break;
          }

          // Update subscription status based on Stripe status
          if (subscription.status === 'active') {
            // @ts-ignore - current_period_end exists on Stripe.Subscription
            const periodEnd = subscription.current_period_end as number;
            const endDate = new Date(periodEnd * 1000);
            await storage.updateSubscriptionStatus(userId, true, endDate);
            console.log(`Updated subscription for user ${userId} - active until ${endDate}`);
          } else {
            // Subscription canceled, expired, or past_due
            await storage.updateSubscriptionStatus(userId, false, null);
            console.log(`Deactivated subscription for user ${userId}`);
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
