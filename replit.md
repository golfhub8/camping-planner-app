# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize outdoor adventures. It offers secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts. A Pro Membership ($29.99/year with 7-day free trial) grants access to printable camping planners and games. The application is built as a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 application with TypeScript, Vite, and Wouter for routing. State management and data fetching are handled by TanStack Query, incorporating optimistic updates. The UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, featuring a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction. Authentication leverages Replit Auth for seamless OIDC login and protects routes. A persistent Navbar component appears on all authenticated pages, featuring the app logo, primary navigation links (Recipes, Trips, Printables) with smart active state highlighting, a "Go Pro" subscribe button for Stripe checkout, and a logout button.

### Backend

The backend is an Express.js application built with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication with a PostgreSQL session store. Most API routes are protected by `isAuthenticated` middleware. User ownership is strictly verified for all data access. The API provides endpoints for user authentication, CRUD operations on user-owned recipes, dynamic grocery list generation (including from trip meal plans with pantry item preservation), and comprehensive trip management (creation, collaborators, cost tracking, meal planning, shareable grocery links). Weather forecasting is integrated via Open-Meteo API using trip coordinates. Payment processing is integrated via Stripe Checkout Sessions for Pro Membership, with robust webhook handlers that store subscription status locally for efficient Pro access checks (avoiding per-request Stripe API calls). Webhooks include email-based user lookup fallback and automatic metadata patching for legacy subscriptions. Pro access is granted for subscription statuses: active, trialing, and past_due (grace period). Live WordPress integration provides external recipes from TheCampingPlanner.com, automatically updating with new content. Zod is used for schema validation on all request and response payloads.

### Data Layer

Data persistence uses PostgreSQL with the Neon serverless driver, accessed via Drizzle ORM. A robust database schema defines tables for users, sessions, recipes, trips (including optional `lat`/`lng` for weather), and shared_grocery_lists. `userId` foreign keys enforce user ownership. The `users` table includes `proMembershipEndDate`, `subscriptionStatus` (cached Stripe status for efficient access checks), and `selectedCampingBasics`. Drizzle-Zod integration ensures schema validation, and `drizzle-kit` manages database migrations.

## External Dependencies

*   **Authentication:** Replit Auth (OpenID Connect for Google, GitHub, and email/password logins).
*   **Database:** PostgreSQL (via Neon serverless driver).
*   **ORM:** Drizzle ORM and Drizzle-Kit.
*   **Payment Processing:** Stripe Checkout Sessions for Pro Membership ($29.99/year with 7-day free trial).
*   **WordPress Integration:** Live recipe fetching from TheCampingPlanner.com via WordPress REST API.
*   **Weather API:** Open-Meteo free weather API for real-time forecasts (no API key required).
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.