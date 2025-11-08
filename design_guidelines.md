# Design Guidelines: The Camping Planner - Recipes Feature

## Design Approach

**Selected Approach**: Clean, Modern Outdoor Aesthetic

Inspired by The Camping Planner logo, this design embraces a clean, modern, and family-friendly aesthetic. The focus is on creating a fresh, contemporary feeling with teal accent colors, clean typography, and a minimalist approach that makes the brand feel professional and approachable.

---

## Core Design Elements

### Color Palette

**Primary Colors (From Logo)**:
- **Primary Teal**: Vibrant teal (#4DB4AC) - fresh, modern, outdoor feel
- **Black**: Pure black (#000000) - clean, professional for text
- **White**: Pure white (#FFFFFF) - clean, spacious backgrounds

**Neutral Base**:
- **Background**: Pure white (#FFFFFF) - clean, modern
- **Text**: Near-black (#1A1A1A) - strong contrast, readable
- **Muted text**: Medium gray (#737373)

**Supporting Colors**:
- **Card backgrounds**: Very light gray (#FAFAFA)
- **Borders**: Light gray (#E6E6E6)

### Typography
- **Primary Font**: System UI sans-serif stack - clean, modern, readable
- **Body Font**: Same as primary - consistent, professional
- **Font Weight**: Bold for headings to match logo's bold aesthetic

**Font Sizes**:
- H1: 2.5rem (40px), Bold
- H2: 2rem (32px), Semi-bold
- H3: 1.5rem (24px), Semi-bold
- Body: 1rem (16px), Regular, line-height 1.6
- Small: 0.875rem (14px)

### Layout System

**Spacing**: Clean, modern spacing (balanced and professional)
- Use units: 2, 4, 6, 8, 12, 16, 20, 24

**Container Strategy**:
- Main content: `max-w-6xl mx-auto px-6 md:px-10` - comfortable width
- Consistent padding throughout

---

## Component Library

### Navigation Header
- White background with subtle border
- Logo image (actual branding) on left
- Clean navigation links
- Search bar on right
- Teal accent for active states

### Recipe Cards
- Light gray background
- Clean borders
- Rounded corners
- Hover: subtle elevation
- Teal accents for badges and icons

### Create Recipe Form
- Expandable design
- Light card background
- Teal accent for create button
- Clean input fields
- Clear helper text

### Recipe Detail Page
- Two-column layout on desktop
- Checkable ingredients with teal checkboxes
- Numbered steps with clean badges
- Back button with teal accent
- Modern, spacious design

### Buttons
**Primary Button**: 
- Teal background (#4DB4AC)
- White text
- Rounded-md
- Comfortable padding (px-4 py-2)

**Secondary Button**:
- Light gray background
- Black text
- Clean borders

### Empty States
- Clean, friendly messaging
- Simple icon in muted teal
- Clear call-to-action

### Icons
Use Lucide React:
- Tent, Search, Plus for common actions
- All in teal or black depending on context

---

## Visual Style

**Overall Feel**: Clean, modern, professional with outdoor appeal

**Textures**: Minimal - focus on clean design

**Shadows**: Subtle, clean shadows

**Borders**: Light gray, clean lines

**Interactions**: Subtle hover states with teal accents

---

## Accessibility

- High contrast between teal and white/black
- All interactive elements clearly defined
- Focus states visible with teal outline
- Comfortable touch targets (min 44px)
- Readable font sizes throughout
