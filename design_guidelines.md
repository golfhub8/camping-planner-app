# Design Guidelines: The Camping Planner - Recipes Feature

## Design Approach

**Selected Approach**: Warm, Rustic Outdoor Aesthetic

Inspired by the actual thecampingplanner.com website, this design embraces a warm, welcoming, and family-friendly aesthetic. The focus is on creating a cozy, campfire-gathering feeling with earthy tones, approachable typography, and natural warmth that makes users feel like they're planning around a campfire with friends.

---

## Core Design Elements

### Color Palette

**Primary Colors (Warm Earth Tones)**:
- **Primary Accent**: Warm terracotta/burnt orange (#D97757) - evokes campfire warmth
- **Secondary Green**: Forest green (#4A7C59) - natural, outdoorsy
- **Warm Brown**: Rich brown (#8B6F47) for accents

**Neutral Base**:
- **Background**: Warm off-white (#FAF8F5) - not stark white, warmer feel
- **Text**: Warm dark brown (#2D2416) - easier on eyes than black
- **Muted text**: Warm gray-brown (#6B5D52)

**Supporting Colors**:
- **Card backgrounds**: Soft cream (#F5F2ED)
- **Borders**: Light tan (#E8E3DB)

### Typography
- **Primary Font**: Merriweather (serif) - warm, readable, traditional feel for headings
- **Body Font**: Open Sans (sans-serif) - clean, friendly for body text
- **Accent Font**: Architects Daughter (handwriting) - for special touches, playful elements

**Font Sizes**:
- H1: 2.5rem (40px), Merriweather, weight 700
- H2: 2rem (32px), Merriweather, weight 600
- H3: 1.5rem (24px), Merriweather, weight 600
- Body: 1rem (16px), Open Sans, weight 400, line-height 1.6
- Small: 0.875rem (14px)

### Layout System

**Spacing**: Generous, comfortable spacing (more relaxed than tech apps)
- Use units: 3, 4, 6, 8, 12, 16, 20, 24

**Container Strategy**:
- Main content: `max-w-6xl mx-auto px-6 md:px-10` - more breathing room
- Comfortable padding throughout

---

## Component Library

### Navigation Header
- Warm background with subtle texture feel
- Logo with tent icon, warm terracotta color
- Generous padding (py-5)
- Soft shadow beneath
- Navigation links in warm brown, terracotta when active

### Recipe Cards
- Soft cream background
- Warm border
- Rounded corners (slightly more rounded than default)
- Hover: gentle lift with warm shadow
- Ingredient count badge in terracotta
- Created date with warm brown icon

### Create Recipe Form
- Expandable design with warm call-to-action
- Cream card background
- Terracotta accent for create button
- Comfortable input spacing
- Helper text in warm muted tones

### Recipe Detail Page
- Two-column layout on desktop
- Checkable ingredients with terracotta checkboxes
- Numbered steps with warm circular badges
- Print button prominent
- Warm, inviting spacing

### Buttons
**Primary Button**: 
- Terracotta background (#D97757)
- Cream text
- Rounded-lg
- Comfortable padding (px-6 py-3)

**Secondary Button**:
- Transparent with terracotta border
- Terracotta text
- Hover: light terracotta background

### Empty States
- Warm, friendly messaging
- Soft icon in muted terracotta
- Encouraging call-to-action

### Icons
Use Lucide React:
- Tent, Flame, ChefHat for branding
- Calendar, Eye, Search for actions
- All in warm earth tones

---

## Visual Style

**Overall Feel**: Cozy campfire gathering, family-friendly, warm and inviting

**Textures**: Subtle (no heavy textures, but warmth through color)

**Shadows**: Soft, warm shadows (slight brown tint rather than pure gray)

**Borders**: Warm tan/brown rather than cold gray

**Interactions**: Gentle, warm hover states with terracotta accents

---

## Accessibility

- Warm color contrast still meets WCAG AA standards
- All interactive elements clearly defined
- Focus states visible with terracotta outline
- Comfortable touch targets (min 44px)
- Readable font sizes throughout
