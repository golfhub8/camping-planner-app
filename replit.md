# The Camping Planner

## Overview
The Camping Planner is a full-stack web application designed to help camping families organize outdoor adventures. It provides secure user authentication, user-owned data, and robust modules for managing recipes, grocery lists, and camping trips. Key capabilities include creating and searching recipes, generating categorized shopping lists from selected recipes or entire trip meal plans, and comprehensive trip management with collaboration and cost tracking. The project aims to provide a seamless planning experience for outdoor enthusiasts, with a Pro Membership offering additional features like printable planners and games.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is a React 18 application with TypeScript, Vite, and Wouter for routing. UI is built with Shadcn/ui (New York style) on Radix UI primitives, styled with Tailwind CSS, featuring a custom teal-centric color palette and modern typography. The design emphasizes a clean, outdoor aesthetic, responsiveness, and user-friendly interaction. A persistent Navbar provides navigation and account management, dynamically displaying "Go Pro" or "Pro Member" status.

### Technical Implementation
The backend is an Express.js application with TypeScript, providing a REST API. Authentication is integrated with Replit Auth via OpenID Connect, using session-based authentication and PostgreSQL session store. Most API routes are protected by `isAuthenticated` middleware, ensuring user data ownership. Zod is used for schema validation. The `useLogout` hook ensures secure client-side and server-side logout. Free tier usage limits (5 trips, 5 shared grocery lists) are enforced using authoritative database counts (not cached counters), with Pro users bypassing these limits. Trip creation uses direct fetch() for proper 402 PAYWALL handling and includes smart retry logic with exponential backoff. The "Trip Assistant" provides keyword-aware suggestions and real hiking trail recommendations from the National Park Service API, with geographic detection for US-only locations and graceful degradation.

### Feature Specifications
- **Recipe Management:** CRUD operations on user-owned recipes, including saving external WordPress recipes from TheCampingPlanner.com. A server-side recipe parser supports multi-tier extraction (JSON-LD, specific WordPress plugin selectors, generic HTML scraping). Seamless recipe creation workflow deep-links from trip details. Token-based public recipe sharing with link regeneration for revocation.
- **Grocery List Generation & Persistence:** Dynamic grocery list generation from selected recipes or entire trip meal plans, with automatic database persistence to token-based URLs. Lists persist across sessions and count toward free tier limits. Auto-save and duplicate save prevention are implemented.
- **Trip Management:** Comprehensive trip creation, collaboration, cost tracking, and meal planning. Includes quick trip creation and integration with grocery list generation.
- **Recipe-to-Trip Integration:** Query parameter-based deep-linking enables a seamless "create recipe and add to trip" workflow.
- **Weather Forecasting:** Client-side real-time weather forecasts from Open-Meteo API for trips with stored coordinates, captured via Mapbox Geocoding.
- **Account & Subscription:** Account page for plan and subscription management, displaying free/trial/pro status and enabling Stripe billing portal access. The `/api/account/plan` endpoint uses Stripe as the source of truth for subscription data.
- **Sharing:** Token-based public sharing for both recipes and grocery lists, with sanitized public viewing.

### System Design Choices
- **Frontend State Management:** TanStack Query for state management, data fetching, optimistic updates, and caching. Secure logout clears client cache.
- **Authentication:** Replit Auth for OIDC login, with session-based authentication and strict user ownership verification.
- **Payment Processing:** Stripe Checkout Sessions for Pro Membership, with hardened checkout flow, promotion code support, customer metadata, and comprehensive webhook handling.
- **Email System:** Comprehensive automated email system covering subscription lifecycle events (welcome, receipts, renewal reminders, payment failure, trial notifications, cancellation). Modular webhook handler processes critical Stripe events with idempotent processing and safe email dispatch. Admin notifications sent to hello@thecampingplanner.com for new Pro signups, including user email, name, signup timestamp with timezone, Stripe subscription ID, and renewal date.
- **Data Layer:** PostgreSQL with Neon serverless driver, accessed via Drizzle ORM. A robust database schema enforces user ownership and supports `proMembershipEndDate`, `subscriptionStatus`, and usage counters. Drizzle-Zod integration for schema validation.
- **Grocery List Flow:** Multi-step wizard with sessionStorage for ingredient data. Auto-saves on mount, clears sessionStorage on exit, and provides retry UI for errors. Unified recipe selection with bidirectional syncing and deduplication.
- **Security:** SSRF protection for recipe scraping endpoints (DNS resolution, private IP blocking, HTTPS enforcement). Recipe sharing endpoints sanitize public responses. Token generation includes collision detection and regeneration.
- **Printables Management:** Manifest-driven architecture using `assets/printables/manifest.ts` as the single source of truth for PDF metadata. A sync script validates manifest entries against the filesystem.

## External Dependencies
*   **Authentication:** Replit Auth (OpenID Connect).
*   **Database:** PostgreSQL (via Neon serverless driver).
*   **ORM:** Drizzle ORM.
*   **Payment Processing:** Stripe Checkout Sessions.
*   **WordPress Integration:** TheCampingPlanner.com.
*   **Weather API:** Open-Meteo.
*   **Geocoding API:** Mapbox Geocoding API.
*   **Hiking Trails:** National Park Service API.
*   **Fonts:** Google Fonts (Architects Daughter, DM Sans, Fira Code, Geist Mono).
*   **Icons:** Lucide React.