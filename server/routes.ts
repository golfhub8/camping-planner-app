import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, generateGroceryListSchema, insertTripSchema, addCollaboratorSchema, addTripCostSchema, addMealSchema, createSharedGroceryListSchema, type GroceryItem, type GroceryCategory, type Recipe } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";
import Stripe from "stripe";
import { load as cheerioLoad } from "cheerio";

// Initialize Stripe client
// Reference: blueprint:javascript_stripe
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  const keyPrefix = process.env.STRIPE_SECRET_KEY.substring(0, 7);
  console.log(`[Stripe] Initializing with key prefix: ${keyPrefix}`);
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
  console.log('[Stripe] Client initialized successfully');
} else {
  console.error('[Stripe] STRIPE_SECRET_KEY not found in environment');
}

// Register Stripe webhook route BEFORE global JSON middleware
// This is critical for proper signature verification
export function registerWebhookRoute(app: Express): void {
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

          if (purchaseType === 'pro_membership_annual') {
            // Handle annual Pro membership subscription - save customer and subscription IDs
            if (session.customer && session.subscription) {
              await storage.updateStripeCustomerId(userId, session.customer as string);
              await storage.updateStripeSubscriptionId(userId, session.subscription as string);
              
              // Fetch the subscription to get the actual current_period_end (includes trial)
              const subscriptionResponse = await stripe.subscriptions.retrieve(session.subscription as string);
              
              // Type guard: ensure this is an active subscription (not deleted)
              if (!subscriptionResponse || subscriptionResponse.object !== 'subscription') {
                console.error(`Expected subscription object but got: ${subscriptionResponse?.object || 'null'}`);
                break;
              }
              
              // Type guard: ensure current_period_end exists and is a number
              if (!('current_period_end' in subscriptionResponse) || 
                  typeof subscriptionResponse.current_period_end !== 'number') {
                console.error('Subscription missing valid current_period_end');
                break;
              }
              
              const endDate = new Date(subscriptionResponse.current_period_end * 1000);
              await storage.updateProMembershipEndDate(userId, endDate);
              
              console.log(`Activated Pro membership for user ${userId} - status: ${subscriptionResponse.status}, expires ${endDate}`);
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          
          // Type guard: ensure this is an active subscription (not deleted)
          if (subscription.object !== 'subscription') {
            console.error(`Expected subscription object but got: ${subscription.object}`);
            break;
          }
          
          // Find user by Stripe subscription ID
          const userId = subscription.metadata?.app_user_id;
          if (!userId) {
            console.error("No user ID in subscription metadata");
            break;
          }

          // Update Pro membership status based on Stripe subscription status
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            // Type guard: ensure current_period_end exists and is a number
            if (!('current_period_end' in subscription) || 
                typeof subscription.current_period_end !== 'number') {
              console.error('Subscription missing valid current_period_end');
              break;
            }
            
            const endDate = new Date(subscription.current_period_end * 1000);
            await storage.updateProMembershipEndDate(userId, endDate);
            console.log(`Updated Pro membership for user ${userId} - expires ${endDate}`);
          } else {
            // Subscription canceled, expired, or past_due - revoke access
            await storage.updateProMembershipEndDate(userId, null);
            console.log(`Revoked Pro membership for user ${userId}`);
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
}

// Middleware to require Pro membership for printables access
// Checks if user has active Pro membership (includes both trial and paid)
// Usage: app.get("/api/printables", isAuthenticated, requirePrintableAccess, handler)
function requirePrintableAccess(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const userId = req.user.claims.sub;
  
  // Check if user has Pro membership access
  storage.getUser(userId).then(user => {
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check for active Pro membership (including trial period)
    if (user.proMembershipEndDate && user.proMembershipEndDate > new Date()) {
      return next();
    }

    // No valid access
    return res.status(402).json({ error: "Printable access required. Please purchase lifetime access or subscribe." });
  }).catch(err => {
    console.error("Error checking printable access:", err);
    return res.status(500).json({ error: "Failed to verify access" });
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

  // Printables Routes
  
  // GET /api/printables/access
  // Check if user has Pro membership for printables access
  // Includes both trial and paid annual subscriptions
  // Protected route - requires authentication
  app.get('/api/printables/access', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ hasAccess: false, message: "User not found" });
      }

      // Check for active Pro membership (trial or paid)
      if (user.proMembershipEndDate && user.proMembershipEndDate > new Date()) {
        return res.json({ 
          hasAccess: true, 
          accessType: 'pro',
          expiresAt: user.proMembershipEndDate,
          message: "You have Pro membership access to all printables"
        });
      }

      // No access
      return res.json({ 
        hasAccess: false,
        message: "Purchase lifetime access or subscribe to download printables"
      });
    } catch (error) {
      console.error("Error checking printable access:", error);
      res.status(500).json({ hasAccess: false, message: "Failed to check access" });
    }
  });

  // GET /api/printables/downloads
  // Get download links for printables (requires paid access)
  // Protected route - requires authentication AND printable access
  app.get('/api/printables/downloads', isAuthenticated, requirePrintableAccess, async (req: any, res) => {
    // Return download links for all printables
    // For now, return the external shop URLs
    // In the future, this could return actual file download URLs from storage
    const downloads = [
      {
        id: "camping-planner",
        title: "The Camping Planner",
        description: "Plan your perfect camping trip with our comprehensive planner",
        downloadUrl: "https://thecampingplanner.com/shop/",
      },
      {
        id: "activity-book",
        title: "Camping Activity Book",
        description: "Keep the kids entertained with fun camping-themed activities",
        downloadUrl: "https://thecampingplanner.com/shop/",
      },
      {
        id: "games-bundle",
        title: "Camping Games Bundle",
        description: "Make your camping trip unforgettable with our complete games bundle",
        downloadUrl: "https://thecampingplanner.com/shop/",
      },
    ];

    res.json({ downloads });
  });

  // Recipe Routes
  // All routes are prefixed with /api
  // All recipe routes require authentication
  
  // Type definition for structured ingredient from WordPress table
  interface IngredientChecklistItem {
    name: string;
    amountImperial?: string;
    amountMetric?: string;
    notes?: string;
  }

  // Type definition for parsed WordPress recipe content
  interface ParsedRecipeContent {
    ingredientsChecklist: IngredientChecklistItem[];
    extraBullets: string[];
  }

  // Helper function: Parse WordPress recipe HTML to extract structured ingredients
  // This function uses cheerio to parse the HTML and extract both:
  // 1. Structured ingredients from the "Ingredients Checklist" table
  // 2. Extra bullet points (related recipes, tips, etc.)
  // WordPress recipe structure may vary - adjust selectors below if needed
  function parseWordPressRecipe(html: string): ParsedRecipeContent {
    const $ = cheerioLoad(html);
    
    const ingredientsChecklist: IngredientChecklistItem[] = [];
    const extraBullets: string[] = [];
    
    // ========================================
    // PART 1: Extract structured ingredients from table
    // ========================================
    // Look for a table that contains ingredients data
    // The table typically has columns: Ingredient, Amount (Imperial), Metric, Notes
    // ADJUST THIS SELECTOR if your WordPress theme changes the table structure
    
    // Try to find the ingredients table
    // We look for a table that has "Ingredient" in the header
    $('table').each((index: number, tableEl: any) => {
      const $table = $(tableEl);
      const headerCells = $table.find('thead tr th, thead tr td, tr:first-child th, tr:first-child td');
      
      // Check if this looks like an ingredients table by looking at headers
      const headers: string[] = [];
      headerCells.each((i: number, cell: any) => {
        headers.push($(cell).text().trim().toLowerCase());
      });
      
      // If we find "ingredient" in the headers, this is likely our ingredients table
      const hasIngredientHeader = headers.some(h => h.includes('ingredient'));
      
      if (hasIngredientHeader) {
        // Find the column indices for each field
        // ADJUST THESE SEARCH TERMS if your table headers change
        const nameIndex = headers.findIndex(h => h.includes('ingredient'));
        const imperialIndex = headers.findIndex(h => h.includes('imperial') || h.includes('amount'));
        const metricIndex = headers.findIndex(h => h.includes('metric'));
        const notesIndex = headers.findIndex(h => h.includes('note'));
        
        // Get all data rows - prefer tbody if it exists to avoid duplicate processing
        // ADJUST THIS if your table structure doesn't use tbody
        const hasTbody = $table.find('tbody tr').length > 0;
        const rowSelector = hasTbody ? 'tbody tr' : 'tr';
        const dataRows = $table.find(rowSelector);
        
        // Skip first row if we're using all 'tr' (it's the header)
        const startIndex = hasTbody ? 0 : 1;
        
        dataRows.slice(startIndex).each((i: number, rowEl: any) => {
          const $row = $(rowEl);
          const cells = $row.find('td, th');
          
          // Skip if this is a header row
          if (cells.length === 0) return;
          
          // Extract data from each column
          const ingredient: IngredientChecklistItem = {
            name: nameIndex >= 0 ? $(cells[nameIndex]).text().trim() : '',
          };
          
          if (imperialIndex >= 0 && $(cells[imperialIndex]).text().trim()) {
            ingredient.amountImperial = $(cells[imperialIndex]).text().trim();
          }
          
          if (metricIndex >= 0 && $(cells[metricIndex]).text().trim()) {
            ingredient.amountMetric = $(cells[metricIndex]).text().trim();
          }
          
          if (notesIndex >= 0 && $(cells[notesIndex]).text().trim()) {
            ingredient.notes = $(cells[notesIndex]).text().trim();
          }
          
          // Only add if we have at least a name
          if (ingredient.name) {
            ingredientsChecklist.push(ingredient);
          }
        });
      }
    });
    
    // ========================================
    // PART 2: Extract extra bullet points (related recipes, tips, etc.)
    // ========================================
    // We want to collect <li> items, but be smart about filtering:
    // - If we found table-based ingredients, skip the first <ul> (likely suggested recipes)
    // - If no table ingredients were found, include all lists (first list might be ingredients)
    // ADJUST THESE SELECTORS if your WordPress structure changes
    
    const allLists = $('ul');
    
    // Determine starting index: skip first list only if we already have table-based ingredients
    const startIndex = ingredientsChecklist.length > 0 ? 1 : 0;
    
    allLists.slice(startIndex).each((index: number, ulEl: any) => {
      $(ulEl).find('li').each((i: number, liEl: any) => {
        const text = $(liEl).text().trim();
        // Clean up HTML entities
        const cleanText = text
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        
        if (cleanText) {
          extraBullets.push(cleanText);
        }
      });
    });
    
    return {
      ingredientsChecklist,
      extraBullets,
    };
  }

  // Legacy helper function for backward compatibility
  // This is kept for the /ingredients endpoint, but the main endpoint now uses parseWordPressRecipe
  function extractIngredientsFromHtml(html: string): string[] {
    const parsed = parseWordPressRecipe(html);
    // Return the checklist names if available, otherwise extra bullets
    if (parsed.ingredientsChecklist.length > 0) {
      return parsed.ingredientsChecklist.map(item => {
        let text = item.name;
        if (item.amountImperial) text = `${item.amountImperial} ${text}`;
        if (item.notes) text = `${text} (${item.notes})`;
        return text;
      });
    }
    return parsed.extraBullets;
  }
  
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

  // GET /api/external-recipes
  // Fetches latest recipes from WordPress "camping-food" category (ID: 4)
  // Returns: { recipes: Array<{ id, title, slug, url, excerpt, date }> }
  // Protected route - requires authentication
  app.get("/api/external-recipes", isAuthenticated, async (req: any, res) => {
    try {
      // Fetch latest posts from the "camping-food" category (category ID: 4)
      const wpRes = await fetch(
        "https://thecampingplanner.com/wp-json/wp/v2/posts?categories=4&per_page=20"
      );
      
      if (!wpRes.ok) {
        console.error("Failed to fetch from WordPress:", wpRes.status);
        return res.status(500).json({ error: "Failed to fetch external recipes" });
      }
      
      const posts = await wpRes.json();
      
      // Map to the shape our frontend expects
      const recipes = posts.map((p: any) => ({
        id: `wp-${p.id}`,
        title: p.title?.rendered || "Untitled Recipe",
        slug: p.slug,
        url: p.link,
        excerpt: p.excerpt?.rendered || "",
        date: p.date,
        source: "external" as const,
      }));
      
      res.json({ recipes });
    } catch (err) {
      console.error("Failed to fetch external recipes", err);
      res.status(500).json({ error: "Failed to fetch external recipes" });
    }
  });

  // GET /api/recipes/external
  // Fetches camping recipes from TheCampingPlanner.com WordPress site
  // Returns: Array of external recipes with { id, title, source, url, ingredients? }
  // This endpoint tries to fetch posts from the "camping-food" category using WordPress REST API
  // If the API is unavailable or CORS blocks the request, it returns an empty array
  // Protected route - requires authentication
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid matching "external" as an ID
  app.get("/api/recipes/external", isAuthenticated, async (req: any, res) => {
    try {
      // WordPress site base URL
      const siteUrl = "https://thecampingplanner.com";
      
      // Step 1: First, try to find the "camping-food" category ID
      // WordPress REST API exposes categories at /wp-json/wp/v2/categories
      let categoryId: number | null = null;
      
      try {
        const categoriesResponse = await fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=100`);
        
        if (categoriesResponse.ok) {
          const categories = await categoriesResponse.json();
          // Find the category with slug "camping-food"
          const campingFoodCategory = categories.find(
            (cat: any) => cat.slug === "camping-food"
          );
          
          if (campingFoodCategory) {
            categoryId = campingFoodCategory.id;
          }
        }
      } catch (error) {
        console.log("Failed to fetch categories from WordPress:", error);
        // Continue anyway - we'll return empty array at the end
      }
      
      // Step 2: If we found the category ID, fetch posts from that category
      if (categoryId) {
        try {
          // Fetch up to 20 posts from the camping-food category
          // Use _fields parameter to limit the response size for faster loading
          const postsUrl = `${siteUrl}/wp-json/wp/v2/posts?categories=${categoryId}&per_page=20&_fields=id,title,link,excerpt`;
          const postsResponse = await fetch(postsUrl);
          
          if (postsResponse.ok) {
            const posts = await postsResponse.json();
            
            // Transform WordPress posts into our external recipe format
            const externalRecipes = posts.map((post: any) => ({
              // Use WordPress post ID as string to avoid conflicts with internal recipe IDs
              id: `wp-${post.id}`,
              
              // WordPress returns title as { rendered: "..." }
              title: post.title?.rendered || "Untitled Recipe",
              
              // Mark as external source so frontend knows this is from WordPress
              source: "external" as const,
              
              // Link to the full recipe on TheCampingPlanner.com
              url: post.link,
              
              // For now, we can't extract ingredients from WordPress
              // This could be enhanced later with web scraping if needed
              ingredients: undefined,
            }));
            
            return res.json(externalRecipes);
          }
        } catch (error) {
          console.log("Failed to fetch posts from WordPress:", error);
          // Continue to return empty array
        }
      }
      
      // If we couldn't fetch recipes (no category found, CORS error, etc.), return empty array
      // This allows the frontend to still render without breaking
      res.json([]);
    } catch (error) {
      console.error("Error in external recipes endpoint:", error);
      // Return empty array instead of error to gracefully handle failures
      res.json([]);
    }
  });

  // GET /api/recipes/external/:id
  // Fetches a single external recipe from WordPress by post ID
  // Example: /api/recipes/external/wp-12345
  // Returns: { id, title, contentHtml, ingredients[], url }
  // PUBLIC route - no authentication required
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.get("/api/recipes/external/:id", async (req: any, res) => {
    try {
      const externalId = req.params.id;
      
      // Extract the WordPress post ID from our prefixed format (wp-12345 -> 12345)
      // If the ID doesn't start with "wp-", try to use it as-is
      let wpPostId: string;
      if (externalId.startsWith("wp-")) {
        wpPostId = externalId.substring(3); // Remove "wp-" prefix
      } else {
        wpPostId = externalId;
      }
      
      // WordPress site base URL
      // You can change this URL if you move your WordPress site or want to use a different one
      const siteUrl = "https://thecampingplanner.com";
      
      // Fetch the full post from WordPress REST API
      // WordPress REST API endpoint: /wp-json/wp/v2/posts/:id
      // You can add more fields by modifying the _fields parameter below
      const postUrl = `${siteUrl}/wp-json/wp/v2/posts/${wpPostId}`;
      
      const response = await fetch(postUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Recipe not found on WordPress" });
      }
      
      const post = await response.json();
      
      // Extract the HTML content from the post
      // WordPress returns content as { rendered: "..." }
      const contentHtml = post.content?.rendered || "";
      
      // Parse the HTML to extract structured ingredients and extra content
      // Uses cheerio to find ingredients table and filter out unrelated bullets
      const parsed = parseWordPressRecipe(contentHtml);
      
      // Return the recipe data with structured ingredients
      // ingredientsChecklist: Structured table data with amounts and notes
      // extraBullets: Additional content like related recipes or tips
      res.json({
        id: externalId,
        title: post.title?.rendered || "Untitled Recipe",
        contentHtml,
        ingredientsChecklist: parsed.ingredientsChecklist,
        extraBullets: parsed.extraBullets,
        url: post.link,
      });
    } catch (error) {
      console.error("Error fetching external recipe:", error);
      res.status(500).json({ error: "Failed to fetch recipe from WordPress" });
    }
  });

  // GET /api/recipes/external/:id/ingredients
  // Returns just the ingredients array for an external recipe
  // This is a convenience endpoint for "downloading" or copying just the ingredients
  // Example: /api/recipes/external/wp-12345/ingredients
  // Returns: { ingredients: [...] }
  // PUBLIC route - no authentication required
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.get("/api/recipes/external/:id/ingredients", async (req: any, res) => {
    try {
      const externalId = req.params.id;
      
      // Extract the WordPress post ID from our prefixed format (wp-12345 -> 12345)
      let wpPostId: string;
      if (externalId.startsWith("wp-")) {
        wpPostId = externalId.substring(3);
      } else {
        wpPostId = externalId;
      }
      
      // WordPress site base URL (same as above - you can change this if needed)
      const siteUrl = "https://thecampingplanner.com";
      
      // Fetch just the content field to extract ingredients
      // Using _fields parameter to minimize data transfer
      const postUrl = `${siteUrl}/wp-json/wp/v2/posts/${wpPostId}?_fields=content`;
      
      const response = await fetch(postUrl);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Recipe not found on WordPress" });
      }
      
      const post = await response.json();
      const contentHtml = post.content?.rendered || "";
      
      // Extract ingredients using the shared helper function
      const ingredients = extractIngredientsFromHtml(contentHtml);
      
      // Return just the ingredients array (not the full recipe data)
      res.json({ ingredients });
    } catch (error) {
      console.error("Error fetching external recipe ingredients:", error);
      res.status(500).json({ error: "Failed to fetch ingredients from WordPress" });
    }
  });

  // POST /api/recipes/share
  // Shares a recipe with a collaborator via email
  // Body: { recipeId: string | number, toEmail: string }
  // Returns: { message: string } - A message that can be copied and sent
  // This endpoint builds a shareable message about the recipe
  // In the future, this can be connected to an email service to actually send the email
  // Protected route - requires authentication
  // IMPORTANT: This route must come BEFORE /api/recipes/:id to avoid routing conflicts
  app.post("/api/recipes/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate the request body
      const shareSchema = z.object({
        recipeId: z.union([z.number(), z.string()]),
        toEmail: z.string().email("Invalid email address"),
      });
      
      const { recipeId, toEmail } = shareSchema.parse(req.body);
      
      let recipeTitle: string;
      let recipeUrl: string | null = null;
      let recipeIngredients: string[] | undefined;
      
      // Check if this is an external recipe (starts with "wp-") or internal recipe (number)
      if (typeof recipeId === "string" && recipeId.startsWith("wp-")) {
        // This is an external WordPress recipe
        // For external recipes, we don't have the full data stored locally
        // The frontend should have passed the title and URL, but we'll construct a generic message
        recipeTitle = "A Camping Recipe from TheCampingPlanner.com";
        recipeUrl = `https://thecampingplanner.com/category/camping-food/`;
      } else {
        // This is an internal recipe - fetch it from the database
        const numericId = typeof recipeId === "string" ? parseInt(recipeId) : recipeId;
        
        if (isNaN(numericId)) {
          return res.status(400).json({ error: "Invalid recipe ID format" });
        }
        
        const recipe = await storage.getRecipeById(numericId, userId);
        
        if (!recipe) {
          return res.status(404).json({ error: "Recipe not found" });
        }
        
        recipeTitle = recipe.title;
        recipeIngredients = recipe.ingredients;
        // For internal recipes, we don't have a public URL yet
        // In the future, you could generate a shareable link
        recipeUrl = null;
      }
      
      // Build the shareable message
      // This message can be copied by the user and sent manually
      // Or in the future, sent automatically via email service
      let message = `Your friend shared a camping recipe with you!\n\n`;
      message += `Recipe: ${recipeTitle}\n\n`;
      
      if (recipeIngredients && recipeIngredients.length > 0) {
        message += `Ingredients:\n`;
        recipeIngredients.forEach(ingredient => {
          message += `• ${ingredient}\n`;
        });
        message += `\n`;
      }
      
      if (recipeUrl) {
        message += `View the full recipe here: ${recipeUrl}\n`;
      } else {
        message += `Ask your friend for more details about this recipe!\n`;
      }
      
      message += `\nHappy camping! 🏕️`;
      
      // Return the message to the frontend
      res.json({ 
        message,
        recipient: toEmail,
      });
    } catch (error) {
      // Handle validation errors from Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error sharing recipe:", error);
      res.status(500).json({ error: "Failed to share recipe" });
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
  // Create a Stripe Checkout session for Pro Membership using Dashboard Price
  // Uses STRIPE_PRICE_ID environment variable (price_1SRnQBIEQH0jZmIb2XwrLR5v)
  // Protected route - requires authentication
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
    if (!stripe) {
      return res.status(503).json({ error: "Payment system not configured. Please add STRIPE_SECRET_KEY." });
    }

    if (!process.env.STRIPE_PRICE_ID) {
      console.error("Missing STRIPE_PRICE_ID environment variable");
      return res.status(500).json({ error: "Stripe price not configured" });
    }

    try {
      const userId = req.user.claims.sub;

      // Build success and cancel URLs dynamically
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/printables?payment=success`;
      const cancelUrl = `${baseUrl}/subscribe?canceled=true`;

      // Create checkout session using Dashboard Price ID
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        client_reference_id: userId,
        metadata: { 
          app_user_id: userId,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({ error: "Could not create Stripe checkout session" });
    }
  });


  const httpServer = createServer(app);

  return httpServer;
}
