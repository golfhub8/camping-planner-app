# The Camping Planner

## Overview
The Camping Planner is a full-stack web application designed to help camping families organize outdoor adventures. It provides secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts, with a Pro Membership offering additional features like printable planners and games. The application is a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is a React 18 application with TypeScript, Vite, and Wouter for routing. UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, featuring a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction. A persistent Navbar provides navigation (Trips, Recipes, Grocery, Printables) and account management, with a prominent "Go Pro" option for free users. The default route redirects to "/trips" for authenticated users.

### Technical Implementation
The backend is an Express.js application with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication and a PostgreSQL session store. Most API routes are protected by `isAuthenticated` middleware, ensuring user ownership for all data access. Zod is used for schema validation on all request and response payloads. The `useLogout` hook ensures a secure client-side and server-side logout flow by clearing the React Query cache and destroying sessions. Free tier usage limits (5 trips, 5 shared grocery lists) are enforced via counters in the `users` table and middleware checks, with Pro users bypassing these limits. Trip creation includes smart retry logic with exponential backoff for network and server errors. The "Trip Assistant" provides keyword-aware suggestions for campgrounds, meal plans, and packing tips, designed for seamless integration with future AI-powered services.

### Feature Specifications
- **Recipe Management:** CRUD operations on user-owned recipes, including the ability to save external WordPress recipes from TheCampingPlanner.com to personal collections with full instructions, images, and source attribution. Server-side recipe parser with JSON-LD extraction and retry capability for robust external recipe scraping.
- **Grocery List Generation & Persistence:** Dynamic grocery list generation from selected recipes or entire trip meal plans, with automatic database persistence to token-based URLs (`/grocery/list/:token`). Lists persist across sessions, survive page refreshes, and count toward free tier limits (5 lists max for free users). Features multi-meal ingredient aggregation, deduplication, pantry item preservation, and robust error handling with retry UI. Duplicate save prevention ensures one save per sessionStorage payload, with graceful error recovery for paywall and network failures.
- **Trip Management:** Comprehensive trip creation, collaboration, cost tracking, and meal planning. Includes quick trip creation flow with auto-filled defaults.
- **Weather Forecasting:** Client-side real-time weather forecasts from Open-Meteo API for trips with stored coordinates, captured via Mapbox Geocoding.
- **Account & Subscription:** Account page for plan and subscription management, displaying free/trial/pro status, usage statistics, and enabling Stripe billing portal access. Manual subscription sync endpoint enables immediate Pro status updates after checkout completion.
- **Sharing:** Email sharing functionality for grocery lists via mailto: links, in addition to standard shareable URLs.

### System Design Choices
- **Frontend State Management:** TanStack Query for state management and data fetching, incorporating optimistic updates and robust caching strategies. Secure logout flow clears client cache before OIDC redirect.
- **Authentication:** Replit Auth for OIDC login, with session-based authentication and strict user ownership verification.
- **Payment Processing:** Stripe Checkout Sessions for Pro Membership, with hardened checkout flow, promotion code support, customer metadata, and webhook handling for subscription status updates (idempotency, automatic cleanup, duplicate prevention). Pro access is granted for active, trialing, and past_due subscription statuses. Manual `/api/billing/sync-subscription` endpoint provides immediate subscription status synchronization as fallback to webhooks.
- **Data Layer:** PostgreSQL with Neon serverless driver, accessed via Drizzle ORM. A robust database schema enforces user ownership and supports `proMembershipEndDate`, `subscriptionStatus` (cached Stripe status), and usage counters. The `shared_grocery_lists` table stores all saved grocery lists with token-based access, optional trip association, and user ownership tracking. Drizzle-Zod integration for schema validation, `drizzle-kit` for migrations.
- **Grocery List Flow:** Multi-step wizard (GrocerySelection → confirmation → auto-save → redirect). SessionStorage passes ingredient data with trip metadata (tripId, tripName). The GroceryList component auto-saves on mount using a `saveAttempted` guard to prevent duplicates, clears sessionStorage on all exit paths (success/error), and provides retry UI for error recovery. Timer cleanup via useRef prevents memory leaks.
- **Security:** SSRF protection for recipe scraping endpoints with DNS resolution, private IP range blocking, and HTTPS enforcement for external sites.

## External Dependencies
*   **Authentication:** Replit Auth (OpenID Connect).
*   **Database:** PostgreSQL (via Neon serverless driver).
*   **ORM:** Drizzle ORM and Drizzle-Kit.
*   **Payment Processing:** Stripe Checkout Sessions.
*   **WordPress Integration:** TheCampingPlanner.com (WordPress REST API for external recipes).
*   **Weather API:** Open-Meteo free weather API.
*   **Geocoding API:** Mapbox Geocoding API.
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.