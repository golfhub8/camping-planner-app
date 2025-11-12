# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize outdoor adventures. It offers secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts. A Pro Membership ($29.99/year with 7-day free trial) grants access to printable camping planners and games. The application is built as a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 application with TypeScript, Vite, and Wouter for routing. State management and data fetching are handled by TanStack Query, incorporating optimistic updates. The UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, featuring a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction. Authentication leverages Replit Auth for seamless OIDC login and protects routes. A persistent Navbar component appears on all authenticated pages, featuring the app logo, primary navigation links (Recipes, Trips, Printables) with smart active state highlighting, a "Go Pro" subscribe button for Stripe checkout, and a logout button.

### Backend

The backend is an Express.js application built with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication with a PostgreSQL session store. Most API routes are protected by `isAuthenticated` middleware. User ownership is strictly verified for all data access. The API provides endpoints for user authentication, CRUD operations on user-owned recipes, dynamic grocery list generation (including from trip meal plans with pantry item preservation), and comprehensive trip management (creation, collaborators, cost tracking, meal planning, shareable grocery links). Payment processing is integrated via Stripe Checkout Sessions for Pro Membership, with hardened checkout flow: creates Stripe customers with userId metadata before session creation, returns JSON { url } for client-side redirect, proper success/cancel URLs (?payment=success, ?canceled=true), comprehensive error logging, and configuration endpoint to check Stripe availability. Webhook handlers are production-ready with idempotency (in-memory event ID tracking for 24 hours), automatic cleanup, and duplicate prevention. Webhooks store subscription status locally for efficient Pro access checks (avoiding per-request Stripe API calls), include email-based user lookup fallback, and automatic metadata patching for legacy subscriptions. Pro access is granted for subscription statuses: active, trialing, and past_due (grace period). Live WordPress integration provides external recipes from TheCampingPlanner.com, automatically updating with new content. Zod is used for schema validation on all request and response payloads.

### Data Layer

Data persistence uses PostgreSQL with the Neon serverless driver, accessed via Drizzle ORM. A robust database schema defines tables for users, sessions, recipes, trips (including optional `lat`/`lng` for weather), and shared_grocery_lists. `userId` foreign keys enforce user ownership. The `users` table includes `proMembershipEndDate`, `subscriptionStatus` (cached Stripe status for efficient access checks), and `selectedCampingBasics`. Drizzle-Zod integration ensures schema validation, and `drizzle-kit` manages database migrations.

## External Dependencies

*   **Authentication:** Replit Auth (OpenID Connect for Google, GitHub, and email/password logins).
*   **Database:** PostgreSQL (via Neon serverless driver).
*   **ORM:** Drizzle ORM and Drizzle-Kit.
*   **Payment Processing:** Stripe Checkout Sessions for Pro Membership ($29.99/year with 7-day free trial).
*   **WordPress Integration:** Live recipe fetching from TheCampingPlanner.com via WordPress REST API.
*   **Weather API:** Open-Meteo free weather API for client-side real-time forecasts (no API key required, fetched directly from browser).
*   **Geocoding API:** Mapbox Geocoding API for location autocomplete with coordinate capture (requires VITE_MAPBOX_TOKEN).
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.

## Key Features

### Weather Forecasting
Client-side weather integration fetches real-time forecasts from Open-Meteo API when trips have stored coordinates. The LocationAutocomplete component (powered by Mapbox) captures latitude/longitude when users select a location from suggestions. WeatherCard component displays current conditions and multi-day forecasts filtered to trip dates, with graceful degradation when coordinates are unavailable. When coordinates are missing, TripDetail displays a helpful hint card (using CloudSunIcon, no emoji) that guides users to use the location autocomplete feature. Weather utilities (`client/src/lib/weather.ts`) handle API requests and WMO weather code translations, using fahrenheit/mph/inches units for US audiences. The useWeather hook manages React Query caching with 30-minute stale time for efficient data fetching.

### Trip Creation Reliability
Trip creation includes smart retry logic with exponential backoff (3 attempts: 500ms, 1000ms, 1500ms) that only retries network failures and server errors (5xx). Validation errors (4xx) and paywall errors (402) are never retried. On the first retry attempt, users see a friendly "Server is waking up..." toast message. The retry mechanism uses HTTP status codes to distinguish retriable errors from non-retriable errors, with per-attempt status tracking to prevent carryover between attempts. Date handling uses z.coerce.date() for automatic ISO string normalization. Coordinates are stored as numeric strings in the database with 6 decimal precision for accurate geolocation.

### Multi-Meal Ingredient Aggregation
The grocery selection system aggregates ingredients from multiple sources using a React Query prefetch strategy. When users select trip meals containing external WordPress recipes, `useQueries` automatically prefetches ingredients keyed by `["/api/recipes/external", externalRecipeId, "ingredients"]` with a 5-minute cache. The UI provides real-time feedback: the "Continue to Review" button disables during loading and displays a spinner with "Fetching ingredients..." text. If external ingredient fetches fail, a destructive Alert component appears with specific error details and a retry button. The `proceedToConfirmation` function synchronously accesses cached query results and blocks navigation if data is incomplete, ensuring the merged ingredient list always includes all selected sources (internal recipes, external trip meals, and ingredient picker payloads). The `mergeIngredients` utility deduplicates and sums ingredient amounts across all sources. Error handling includes toast notifications for user awareness and a dedicated retry handler that refetches only failed queries.

### Save External Recipe to My Recipes with Instructions
Users can save external WordPress recipes from TheCampingPlanner.com to their personal recipe collection with complete instructions for offline access. The SaveRecipeModal component (`client/src/components/SaveRecipeModal.tsx`) provides a dialog with automatic JSON-LD recipe scraping capabilities. When opening the modal with a sourceUrl, it automatically scrapes the external recipe's structured data (using schema.org Recipe format) via the `/api/recipes/scrape` backend endpoint. The scraper (`client/src/lib/recipeScraper.ts`) extracts title, ingredients array, steps/instructions array, and optional recipe image URL from JSON-LD metadata embedded in the recipe webpage. The modal displays a preview showing ingredient count and step count before saving. Users can manually edit all fields before final save. The recipes table schema supports: `title` (varchar), `ingredients` (text[]), `steps` (text[]), `imageUrl` (varchar, nullable), and `sourceUrl` (varchar, nullable) to preserve the original URL reference. SSRF protection on the scrape endpoint uses a domain allowlist (TheCampingPlanner.com) and blocks internal IP ranges to prevent security vulnerabilities. The "Save Recipe" button appears on external recipe cards and integrates with POST /api/recipes. Saved recipes appear in "My Recipes" with full offline access to ingredients and step-by-step instructions, usable in trips, grocery lists, and printables. The RecipeDetail page renders steps as a numbered list with step count badges and source URL attribution for saved external recipes. React Query cache invalidation ensures immediate UI updates after saving.