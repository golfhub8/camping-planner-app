# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize their outdoor adventures. It features a modern, outdoor aesthetic with teal accents and bold typography. The application offers secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts. Pro Membership ($29.99/year with 7-day free trial) grants access to printable camping planners and games. It is built as a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 application with TypeScript, utilizing Vite for fast development and Wouter for lightweight routing. State management and data fetching are handled by TanStack Query, incorporating optimistic updates for a responsive UI. The UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, and features a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction patterns. Authentication leverages Replit Auth for seamless OIDC login and protects routes, redirecting unauthenticated users to a landing page.

### Backend

The backend is an Express.js application built with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication with a PostgreSQL session store. All API routes are protected by `isAuthenticated` middleware, and user ownership is strictly verified for all data access and mutations. The API provides endpoints for user authentication, CRUD operations on user-owned recipes, dynamic grocery list generation, and comprehensive trip management including creation, collaborator management, cost tracking, meal planning, trip-specific grocery list generation, and shareable grocery links for collaborators. Shareable links maintain one persistent token per trip and allow public read-only access to trip grocery lists without requiring authentication. Payment processing is integrated via Stripe Checkout Sessions for Pro Membership ($29.99/year with 7-day free trial), with webhook-based access control ensuring users receive printable access after successful payment. Zod is used for schema validation on all request and response payloads, ensuring type safety across the application.

### Data Layer

Data persistence is managed using PostgreSQL with the Neon serverless driver, accessed via Drizzle ORM. A robust database schema defines tables for users, sessions, recipes, trips, and shared_grocery_lists, with `userId` foreign keys enforcing user ownership. The shared_grocery_lists table stores public shareable links with trip metadata (tripId, tripName, collaborators) and maintains one persistent token per trip. The users table includes `proMembershipEndDate` timestamp to track active Pro memberships (including trial periods). Drizzle-Zod integration ensures schema validation, and `drizzle-kit` manages database migrations.

## External Dependencies

*   **Authentication:** Replit Auth (OpenID Connect) for Google, GitHub, and email/password logins.
*   **Database:** PostgreSQL (via Neon serverless driver) for persistent data storage.
*   **ORM:** Drizzle ORM and Drizzle-Kit for database interaction and migrations.
*   **Payment Processing:** Stripe Checkout Sessions for Pro Membership ($29.99/year with 7-day free trial). Webhook handler processes payment events and grants user access automatically.
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.

## Stripe Integration Setup

The application uses Stripe Checkout Sessions for a secure, hosted payment experience. Required environment variables:

*   `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with `sk_`)
*   `VITE_STRIPE_PUBLIC_KEY`: Your Stripe publishable key (starts with `pk_`)
*   `STRIPE_WEBHOOK_SECRET`: Webhook signing secret from Stripe Dashboard (starts with `whsec_`)

Webhook endpoint: `POST /api/stripe/webhook` - Configure in Stripe Dashboard to listen for:
*   `checkout.session.completed` - Grants Pro membership access after successful trial signup or payment
*   `customer.subscription.updated` - Updates Pro membership end date
*   `customer.subscription.deleted` - Revokes Pro membership access

Pro Membership pricing: $29.99/year with 7-day free trial. The webhook route is registered before global JSON middleware to ensure raw body is available for signature verification.