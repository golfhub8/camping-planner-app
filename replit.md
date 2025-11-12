# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize outdoor adventures. It offers secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts. A Pro Membership ($29.99/year with 7-day free trial) grants access to printable camping planners and games. The application is built as a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 application with TypeScript, Vite, and Wouter for routing. State management and data fetching are handled by TanStack Query, incorporating optimistic updates. The UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, featuring a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction. Authentication leverages Replit Auth for seamless OIDC login and protects routes. A persistent Navbar component appears on all authenticated pages, featuring the app logo, primary navigation links (Recipes, Trips, Printables) with smart active state highlighting, a "Go Pro" subscribe button for Stripe checkout, and a logout button.

### Backend

The backend is an Express.js application built with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication with a PostgreSQL session store. Most API routes are protected by `isAuthenticated` middleware. User ownership is strictly verified for all data access. The API provides endpoints for user authentication, CRUD operations on user-owned recipes, dynamic grocery list generation (including from trip meal plans with pantry item preservation), and comprehensive trip management (creation, collaborators, cost tracking, meal planning, shareable grocery links). Payment processing is integrated via Stripe Checkout Sessions for Pro Membership, with robust webhook handlers that store subscription status locally for efficient Pro access checks (avoiding per-request Stripe API calls). Webhooks include email-based user lookup fallback and automatic metadata patching for legacy subscriptions. Pro access is granted for subscription statuses: active, trialing, and past_due (grace period). Live WordPress integration provides external recipes from TheCampingPlanner.com, automatically updating with new content. Zod is used for schema validation on all request and response payloads.

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
Client-side weather integration fetches real-time forecasts from Open-Meteo API when trips have stored coordinates. The LocationAutocomplete component (powered by Mapbox) captures latitude/longitude when users select a location from suggestions. WeatherCard component displays current conditions and multi-day forecasts filtered to trip dates, with graceful degradation when coordinates are unavailable. Weather utilities (`client/src/lib/weather.ts`) handle API requests and WMO weather code translations, using fahrenheit/mph/inches units for US audiences. The useWeather hook manages React Query caching with 30-minute stale time for efficient data fetching.

### Multi-Meal Ingredient Aggregation
The grocery selection system aggregates ingredients from multiple sources using a React Query prefetch strategy. When users select trip meals containing external WordPress recipes, `useQueries` automatically prefetches ingredients keyed by `["/api/recipes/external", externalRecipeId, "ingredients"]` with a 5-minute cache. The UI provides real-time feedback: the "Continue to Review" button disables during loading and displays a spinner with "Fetching ingredients..." text. If external ingredient fetches fail, a destructive Alert component appears with specific error details and a retry button. The `proceedToConfirmation` function synchronously accesses cached query results and blocks navigation if data is incomplete, ensuring the merged ingredient list always includes all selected sources (internal recipes, external trip meals, and ingredient picker payloads). The `mergeIngredients` utility deduplicates and sums ingredient amounts across all sources. Error handling includes toast notifications for user awareness and a dedicated retry handler that refetches only failed queries.

### Save External Recipe to My Recipes
Users can save external WordPress recipes from TheCampingPlanner.com to their personal recipe collection. The SaveRecipeModal component (`client/src/components/SaveRecipeModal.tsx`) provides a dialog for saving external recipes with smart ingredient parsing. When saving, the modal pre-fills with the external recipe's title, source URL, and ingredients. If ingredients are missing from the array but present in the content HTML, a Smart Parse feature extracts them automatically. The recipes table includes an optional `sourceUrl` field (varchar, nullable) to track the original WordPress URL, allowing users to reference the source while managing recipes locally. The "Save Recipe" button appears on external recipe cards (RecipeCard component) and integrates seamlessly with the existing POST /api/recipes endpoint. After saving, the recipe appears in "My Recipes" and can be used in trips, grocery lists, and all other recipe features. React Query cache invalidation ensures the UI updates immediately after saving.