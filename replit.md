# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize their outdoor adventures. It features a modern, outdoor aesthetic with teal accents and bold typography. The application offers secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts, with ambitions to integrate subscription-based printable resources. It is built as a single-page application with a REST API, PostgreSQL storage, and session-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is a React 18 application with TypeScript, utilizing Vite for fast development and Wouter for lightweight routing. State management and data fetching are handled by TanStack Query, incorporating optimistic updates for a responsive UI. The UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, and features a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction patterns. Authentication leverages Replit Auth for seamless OIDC login and protects routes, redirecting unauthenticated users to a landing page.

### Backend

The backend is an Express.js application built with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication with a PostgreSQL session store. All API routes are protected by `isAuthenticated` middleware, and user ownership is strictly verified for all data access and mutations. The API provides endpoints for user authentication, CRUD operations on user-owned recipes, dynamic grocery list generation, and comprehensive trip management including creation, collaborator management, cost tracking, meal planning, trip-specific grocery list generation, and shareable grocery links for collaborators. Shareable links maintain one persistent token per trip and allow public read-only access to trip grocery lists without requiring authentication. Zod is used for schema validation on all request and response payloads, ensuring type safety across the application.

### Data Layer

Data persistence is managed using PostgreSQL with the Neon serverless driver, accessed via Drizzle ORM. A robust database schema defines tables for users, sessions, recipes, trips, and shared_grocery_lists, with `userId` foreign keys enforcing user ownership. The shared_grocery_lists table stores public shareable links with trip metadata (tripId, tripName, collaborators) and maintains one persistent token per trip. Drizzle-Zod integration ensures schema validation, and `drizzle-kit` manages database migrations.

## External Dependencies

*   **Authentication:** Replit Auth (OpenID Connect) for Google, GitHub, and email/password logins.
*   **Database:** PostgreSQL (via Neon serverless driver) for persistent data storage.
*   **ORM:** Drizzle ORM and Drizzle-Kit for database interaction and migrations.
*   **Payment Processing (In Progress):** Stripe for subscription management.
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.