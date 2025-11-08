# The Camping Planner

## Overview

The Camping Planner is a full-stack web application designed to help camping families organize their outdoor adventures. The application features a clean, modern outdoor aesthetic matching The Camping Planner brand identity with teal accents and bold typography.

**Current Features:**
- **Recipes Module**: Create, browse, and search for camping recipes with ingredients and preparation steps optimized for outdoor cooking
- **Grocery List Builder**: Generate combined shopping lists from selected recipes with automatic categorization, deduplication, and sharing capabilities

The application is built as a modern single-page application (SPA) with a REST API backend, featuring full CRUD capabilities and intelligent data processing.

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