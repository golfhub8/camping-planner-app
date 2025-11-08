import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Recipe Routes
  // All routes are prefixed with /api
  
  // GET /api/recipes
  // Returns all recipes, sorted by newest first
  app.get("/api/recipes", async (req, res) => {
    try {
      const recipes = await storage.getAllRecipes();
      res.json(recipes);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  // GET /api/recipes/:id
  // Returns a single recipe by ID
  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate that ID is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid recipe ID" });
      }

      const recipe = await storage.getRecipeById(id);
      
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
  // Creates a new recipe
  // Body: { title: string, ingredients: string[], steps: string }
  app.post("/api/recipes", async (req, res) => {
    try {
      // Validate the request body against our schema
      const validatedData = insertRecipeSchema.parse(req.body);
      
      // Create the recipe in storage
      const recipe = await storage.createRecipe(validatedData);
      
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
  // Searches recipes by title
  // Query parameter: q (the search query)
  // Example: /api/search?q=chili
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      // Validate that query exists
      if (!query || query.trim() === "") {
        return res.status(400).json({ error: "Search query is required" });
      }

      const recipes = await storage.searchRecipes(query);
      res.json(recipes);
    } catch (error) {
      console.error("Error searching recipes:", error);
      res.status(500).json({ error: "Failed to search recipes" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
