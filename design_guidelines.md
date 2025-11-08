# Design Guidelines: The Camping Planner - Recipes Feature

## Design Approach

**Selected Approach**: Clean Design System with outdoor warmth

This is a utility-focused planning tool where readability and functionality are paramount. Drawing inspiration from **Notion's** clean information architecture combined with **Airbnb's** warm, approachable aesthetic. The design balances practical recipe management with the outdoor/camping lifestyle context.

---

## Core Design Elements

### Typography
- **Primary Font**: Inter or Work Sans (via Google Fonts CDN) - clean, highly legible
- **Headings**: 
  - H1: 2.5rem (40px), font-weight 700
  - H2: 1.875rem (30px), font-weight 600
  - H3: 1.5rem (24px), font-weight 600
- **Body Text**: 1rem (16px), font-weight 400, line-height 1.6 for readability
- **Small Text**: 0.875rem (14px) for metadata, labels

### Layout System

**Spacing Units**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20** (e.g., p-4, gap-6, mb-8)

**Container Strategy**:
- Main content: `max-w-6xl mx-auto px-4 md:px-8`
- Recipe cards: `max-w-4xl` for optimal reading width
- Form inputs: `max-w-2xl` to prevent overly wide text fields

**Grid Layouts**:
- Recipe list: 2-column on tablet (md:grid-cols-2), 3-column on desktop (lg:grid-cols-3)
- Single column on mobile for easy reading

---

## Component Library

### Navigation Header
- Fixed top navigation with subtle shadow
- App title "The Camping Planner" with tent/campfire icon (Heroicons)
- Navigation links: Recipes (active), Trips, Printables, Grocery (greyed for future)
- Search bar integrated in header on desktop, collapsible on mobile
- Height: 16 units (h-16)

### Recipe Cards (List View)
- Clean white cards with subtle border and shadow on hover
- Card structure:
  - Recipe title (H3) with truncation after 2 lines
  - Ingredient count badge: "8 ingredients" with cooking icon
  - Preview of first 3 ingredients as bullet list
  - Metadata footer: Created date with calendar icon
  - "View Recipe" link with arrow icon
- Spacing: p-6, gap-4 between elements
- Rounded corners: rounded-lg

### Create Recipe Form
- Prominent placement at top of page or as expandable section
- Card container with clear visual hierarchy
- Form structure:
  - Title input: Full-width, large text input (h-12)
  - Ingredients textarea: 6 rows minimum, placeholder: "Enter each ingredient on a new line"
  - Steps textarea: 10 rows minimum, monospace font option for better formatting
  - Helper text below each field explaining format
  - Submit button: Primary action, full-width on mobile, auto-width on desktop
- Spacing: p-8, gap-6 between fields

### Recipe Detail Page
- Hero section with recipe title (H1) and metadata row
- Two-column layout on desktop:
  - Left column (60%): Ingredients with checkboxes for tracking
  - Right column (40%): Step-by-step instructions numbered
- Single column stack on mobile
- Print button with printer icon
- Back to recipes link at top

### Search Interface
- Search input in header: rounded-full, with search icon prefix
- Search results page: Same card layout as recipe list
- Empty state: Friendly message with illustration placeholder "No recipes found"
- Result count: "Found 5 recipes for 'mac'"

### Buttons & Interactive Elements
**Primary Button**: 
- Height: h-12, padding: px-8
- Rounded: rounded-lg
- Icon + text combination where appropriate
- Loading state: Spinner icon during submission

**Secondary Button/Link**:
- Height: h-10, padding: px-6
- Transparent with border
- Icon prefix for context (arrow, external link, etc.)

### Icons
Use **Heroicons** (via CDN):
- Navigation: home, map, document, shopping-cart
- Recipe actions: eye, plus-circle, printer, magnifying-glass
- Content: check-circle (steps), beaker (ingredients), calendar, clock

### Empty States
- Center-aligned with icon (from Heroicons)
- Message: "No recipes yet. Create your first camping recipe!"
- Call-to-action button below message
- Spacing: py-20

### Input Fields
- Consistent height: h-12 for text inputs
- Border: 1px solid, increased on focus
- Rounded: rounded-lg
- Placeholder text with helpful examples
- Labels: font-weight 500, mb-2

---

## Page-Specific Layouts

### Home Page Structure
1. **Header Navigation** (fixed)
2. **Page Title Section**: "My Camp Recipes" with recipe count, centered, py-8
3. **Create Recipe Form**: Expandable card with "New Recipe" button toggle
4. **Recipe Grid**: 3-column responsive grid with gap-6
5. **Footer**: Simple centered text with app version

### Individual Recipe Page
1. **Header Navigation** (fixed)
2. **Recipe Hero**: Title, created date, edit icon (placeholder)
3. **Content Area**: Two-column ingredients/steps layout
4. **Action Bar**: Print, Share (placeholder), Delete buttons

### Search Results Page
1. **Header Navigation** with active search query
2. **Results Header**: Query and count
3. **Recipe Grid**: Same as home page
4. **No Results**: Empty state if query returns nothing

---

## Images

**Hero Image**: Not needed for this utility-focused app. The emphasis is on content clarity and quick access to recipe information.

**Placeholder Images**: For future enhancement, recipe cards could include optional thumbnail images (square format, 200x200px), but start without images to keep the MVP clean and fast.

---

## Animations

**Minimal Motion**:
- Hover states: Subtle scale (scale-[1.02]) on recipe cards
- Form submission: Button loading spinner only
- Page transitions: None (instant navigation for speed)

---

## Accessibility Notes

- All form inputs have associated labels (not just placeholders)
- Recipe cards are keyboard navigable
- Color contrast meets WCAG AA standards minimum
- Focus states are visible and clear on all interactive elements
- Checkboxes in ingredient lists are proper input elements, not just styled divs