# The Camping Planner - Recipes Feature

## Overview

The Camping Planner is a full-stack web application designed to help campers organize and discover camping recipes. The application features a clean, modern outdoor aesthetic matching The Camping Planner brand identity with teal accents and bold typography. Users can create, browse, and search for camping recipes with ingredients and preparation steps optimized for outdoor cooking.

The application is built as a modern single-page application (SPA) with a REST API backend, featuring a recipe management system with full CRUD capabilities and search functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast hot module replacement (HMR)
- Wouter for lightweight client-side routing instead of React Router
- Path aliases configured for clean imports (`@/` for client code, `@shared/` for shared types)

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management and caching
- Custom query client with infinite stale time to prevent unnecessary refetches
- Optimistic updates via mutation callbacks to keep UI responsive

**UI Component System**
- Shadcn/ui component library (New York style) with Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Custom color palette implementing teal primary color (#4DB4AC) with clean grays and black/white
- Typography system using modern sans-serif fonts with bold headings
- Responsive design with mobile-first approach
- Actual logo image displayed in header

**Design Philosophy**
- Clean, modern outdoor aesthetic matching The Camping Planner brand
- Teal accent color throughout for badges, buttons, and interactive elements
- Custom elevation system with hover and active states for interactive elements
- Card-based layout for recipe display with visual hierarchy
- Focus on readability and family-friendly interaction patterns

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for REST API endpoints
- Custom middleware for request logging and JSON body parsing
- Error handling with appropriate HTTP status codes

**API Design**
- RESTful endpoints under `/api` prefix
- GET `/api/recipes` - Fetch all recipes (sorted by newest first)
- GET `/api/recipes/:id` - Fetch single recipe by ID
- POST `/api/recipes` - Create new recipe
- GET `/api/search?q=query` - Search recipes by title (case-insensitive)
- JSON request/response format with Zod schema validation

**Data Layer**
- Abstract storage interface (`IStorage`) for flexibility in data persistence
- In-memory implementation (`MemStorage`) for development/prototyping
- Data structures support future migration to database (Drizzle ORM configured)
- Auto-incrementing IDs and timestamp tracking for recipes

**Type Safety**
- Shared schema definitions between frontend and backend using Zod
- Drizzle-Zod integration for database schema validation
- TypeScript strict mode enabled across the entire codebase

### External Dependencies

**Database & ORM**
- Drizzle ORM configured for PostgreSQL with Neon serverless driver
- Migration system set up via `drizzle-kit` (migrations directory configured)
- Schema defined in `shared/schema.ts` with recipes and users tables
- Currently using in-memory storage; Postgres connection ready for production deployment

**Third-Party Services**
- Google Fonts: Architects Daughter, DM Sans, Fira Code, Geist Mono for typography
- No external APIs or authentication services currently integrated
- User authentication schema prepared but not yet implemented

**Development Tools**
- Replit-specific plugins for development (cartographer, dev-banner, runtime error overlay)
- ESBuild for production server bundling
- PostCSS with Autoprefixer for CSS processing

**Key npm Packages**
- `@tanstack/react-query` - Server state management
- `wouter` - Lightweight routing
- `date-fns` - Date formatting and manipulation
- `zod` - Runtime type validation
- `class-variance-authority` & `clsx` - Conditional styling utilities
- `lucide-react` - Icon system
- Multiple Radix UI packages for accessible component primitives