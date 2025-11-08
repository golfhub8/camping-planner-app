# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize their outdoor adventures. The application features a clean, modern outdoor aesthetic matching The Camping Planner brand identity with teal accents and bold typography.

**Current Features:**
- **Recipes Module**: Create, browse, and search for camping recipes with ingredients and preparation steps optimized for outdoor cooking
- **Grocery List Builder**: Generate combined shopping lists from selected recipes with automatic categorization, deduplication, and sharing capabilities
- **Trips Module**: Full trip management with UI for creating trips, viewing trip lists, dates, locations, collaborators, and cost tracking

The application is built as a modern single-page application (SPA) with a REST API backend, featuring full CRUD capabilities, intelligent data processing, and persistent PostgreSQL storage.

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
- Custom query client with 5-minute stale time to balance performance and freshness
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

*Recipe Endpoints:*
- GET `/api/recipes` - Fetch all recipes (sorted by newest first)
- GET `/api/recipes/:id` - Fetch single recipe by ID
- POST `/api/recipes` - Create new recipe
- GET `/api/search?q=query` - Search recipes by title (case-insensitive)

*Grocery List Endpoints:*
- POST `/api/grocery/generate` - Generate grocery list from selected recipe IDs
  - Accepts: `{ recipeIds: number[] }`
  - Returns: Categorized and deduplicated ingredient list
  - Categories: Produce, Dairy, Meat, Pantry, Camping Gear
  - Uses keyword-based categorization with intelligent pattern matching

*Trip Endpoints:*
- GET `/api/trips` - Fetch all trips (sorted by start date, newest first)
- GET `/api/trips/:id` - Fetch single trip by ID with all details
- POST `/api/trips` - Create new trip
  - Accepts: `{ name: string, location: string, startDate: ISO string, endDate: ISO string }`
  - Dates are coerced from ISO strings to Date objects
- POST `/api/trips/:id/collaborators` - Add collaborator to trip
  - Accepts: `{ collaborator: string }`
  - Collaborators are normalized (trimmed, lowercased) for case-insensitive matching
  - Deduplicates automatically
- POST `/api/trips/:id/cost` - Update trip cost information
  - Accepts: `{ total: number, paidBy?: string }`
  - Cost stored with 2 decimal places for accurate calculations

- JSON request/response format with Zod schema validation

**Data Layer**
- Abstract storage interface (`IStorage`) for flexibility in data persistence
- PostgreSQL database using Neon serverless driver (migrated from in-memory storage)
- Database implementation (`DatabaseStorage`) for persistent data storage
- In-memory implementation (`MemStorage`) still available as fallback
- Auto-incrementing IDs and timestamp tracking for all entities
- Database schema synced via `npm run db:push` command

**Type Safety**
- Shared schema definitions between frontend and backend using Zod
- Drizzle-Zod integration for database schema validation
- TypeScript strict mode enabled across the entire codebase

### External Dependencies

**Database & ORM**
- Drizzle ORM configured for PostgreSQL with Neon serverless driver
- Migration system set up via `drizzle-kit` (schema push command: `npm run db:push`)
- Schema defined in `shared/schema.ts` with recipes, trips, and users tables
- **Active**: Using PostgreSQL database for persistent storage (recipes and trips)
- Database connection managed via environment variable `DATABASE_URL`

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

## Feature Details

### Recipes Module
Users can create camping recipes with titles, ingredient lists, and preparation steps. The recipe system includes:
- Full CRUD operations (Create, Read, Update would require additional implementation, Delete would require additional implementation)
- Search functionality by recipe title
- Recipe detail pages with complete ingredient and step information
- Responsive card-based layout for browsing

### Grocery List Builder (NEW)
The grocery list feature helps families prepare for camping trips by combining ingredients from multiple recipes:

**Workflow:**
1. **Selection** (`/grocery`) - Users select one or more recipes from their collection
2. **List View** (`/grocery/list`) - System generates a categorized, deduplicated shopping list
   - Ingredients automatically grouped by category (Produce, Dairy, Meat, Pantry, Camping Gear)
   - Checkboxes allow marking items already owned
   - "Show Only Needed" toggle filters to unchecked items
   - Real-time count of needed items
3. **Share** (`/grocery/share`) - Clean, copyable format for texting/emailing
   - One-click clipboard copy
   - Plain text format optimized for mobile messaging
   - Categorized display with visual icons

**Technical Implementation:**
- Grocery lists are generated dynamically (not persisted to database)
- Case-insensitive deduplication ensures "Milk" and "milk" are treated as one item
- Keyword-based categorization uses regex patterns for intelligent grouping
- Session storage temporarily holds list data for sharing workflow
- Category icons use Lucide React components (no emojis per design guidelines)

### Trips Module (Complete)
The trips module provides full functionality for managing camping trips with collaborative planning and cost-splitting:

**Backend Features:**
- Create trips with name, location, start date, and end date
- Store trips persistently in PostgreSQL database
- Add collaborators to trips (emails or names)
- Collaborator normalization: all stored in lowercase for case-insensitive matching
- Automatic deduplication prevents adding the same collaborator twice
- Track total grocery cost for the trip
- Record who paid for groceries (for cost-splitting calculations)
- Cost stored as numeric with 2 decimal places for accuracy

**Frontend Features:**
- Trips page (`/trips`) accessible via header navigation
- Create trip form with React Hook Form and Zod validation
- Trip list view displaying all trips as interactive cards
- Date formatting with date-fns (displays as "MMM d - MMM d, yyyy")
- Responsive card layout with hover effects
- Shows collaborator count, cost information, and meal planning
- TanStack Query for data fetching and cache management
- Real-time updates after creating trips

**Database Schema:**
- `id`: Auto-incrementing primary key
- `name`: Trip name (e.g., "Goldstream Weekend")
- `location`: Trip location (e.g., "Goldstream Provincial Park")
- `startDate`: Trip start timestamp
- `endDate`: Trip end timestamp
- `meals`: Array of recipe IDs attached to trip (defaults to empty)
- `collaborators`: Array of collaborator emails/names (normalized to lowercase)
- `costTotal`: Numeric(10,2) total grocery cost (nullable)
- `costPaidBy`: Text field for who paid (nullable)
- `createdAt`: Trip creation timestamp

**Data Normalization:**
- Collaborators: Trimmed and lowercased for consistent storage
- Costs: Stored with exactly 2 decimal places (e.g., "245.50", "300.00")
- Dates: Coerced from ISO strings to Date objects via Zod schema

**Implementation Status:**
- Backend API fully implemented and tested ✓
- Frontend UI fully implemented and tested ✓
- All endpoints validated via comprehensive E2E testing ✓
- Trip detail page (view/edit single trip) - not yet implemented