# Printables Asset Management

This directory is the **single source of truth** for all PDF printables in The Camping Planner app.

## Directory Structure

```
assets/printables/
├── manifest.ts    # TypeScript manifest - defines all printables metadata
├── free/          # Free printables (accessible to all users)
├── pro/           # Pro printables (requires Pro membership)
└── README.md      # This file
```

## How It Works (Manifest-Driven Architecture)

The printables system is **manifest-driven** using `assets/printables/manifest.ts` as the single source of truth:

1. **Manifest defines everything**: All printable metadata (slug, filename, title, description, tier, paper size) lives in `manifest.ts`
2. **Add PDFs to assets**: Place new PDF files in the appropriate subdirectory (`free/` or `pro/`)
3. **Run sync script**: Execute `node scripts/sync-printables.mjs --clean --verify` to validate and distribute PDFs
4. **Backend consumes manifest**: Routes automatically load printables from manifest and filter by file existence

### File Distribution (After Sync)
- Free PDFs → `client/public/printables/` (dev) and `public/printables/` (production)
- Pro PDFs → `server/private/printables/` (protected API endpoint)

## Adding New Printables

### Step 1: Add PDF to Assets
Place your PDF file in the appropriate directory using the **slug-based naming convention**:

**Naming Convention**: `{slug}-{paperSize}.pdf`

Examples:
- `camping-planner-us-letter.pdf` (Pro)
- `free-charades-us-letter.pdf` (Free)
- `mega-activity-book-a4.pdf` (Pro)

```bash
# Add to appropriate directory
cp your-new-printable-us-letter.pdf assets/printables/pro/
# OR
cp your-free-printable-a4.pdf assets/printables/free/
```

### Step 2: Update Manifest
Edit `assets/printables/manifest.ts` and add your printable:

```typescript
export const PRINTABLES_MANIFEST: PrintableManifest[] = [
  // ... existing entries ...
  {
    slug: 'your-new-printable',           // Unique identifier (used in URLs)
    filename: 'your-new-printable-us-letter.pdf', // Must match actual file
    title: 'Your New Printable Title',    // Display name
    description: 'Description here',      // Marketing copy
    tier: 'pro',                          // 'free' or 'pro'
    paperSize: 'us-letter',              // 'us-letter' or 'a4'
    icon: 'FileText',                     // Lucide icon name (optional)
  },
];
```

### Step 3: Run Sync Script with Validation
```bash
node scripts/sync-printables.mjs --clean --verify
```

This will:
- ✅ Validate manifest entries have corresponding PDF files
- ✅ Detect orphaned PDFs not in manifest
- ✅ Remove 0-byte and stale files
- ✅ Copy valid PDFs to all destinations
- ✅ Verify file integrity with SHA-256 hashes

### Step 4: Restart the Application
The new printable will automatically appear in the frontend (no route changes needed).

## Current Printables

### Free Printables (in `assets/printables/free/`)
- ✅ `free-charades-us-letter.pdf` (133KB)

### Pro Printables (in `assets/printables/pro/`)
- ✅ `camping-games-a4.pdf` (9.2MB)
- ✅ `mega-activity-book-us-letter.pdf` (11MB)

### Missing Pro Printables
The following Pro printables are defined in the manifest but **not yet uploaded**:
- ❌ `camping-planner-us-letter.pdf`
- ❌ `camping-planner-a4.pdf`
- ❌ `ultimate-planner-us-letter.pdf`
- ❌ `games-bundle-us-letter.pdf`

**Action Required**: Upload these PDF files to `assets/printables/pro/` and uncomment their entries in `manifest.ts`.

## Sync Script Details

The sync script (`scripts/sync-printables.mjs`) performs the following:

### 1. Manifest Validation Phase
- Loads `manifest.ts` via `npx tsx`
- Validates each manifest entry has a corresponding PDF in `assets/printables/{tier}/`
- Reports missing PDFs

### 2. Orphan Detection Phase
- Scans `assets/printables/free/` and `assets/printables/pro/`
- Reports any PDFs not registered in the manifest
- Helps prevent forgotten or undocumented files

### 3. Cleanup Phase
- ALWAYS removes 0-byte files (regardless of flags)
- With `--clean`: Removes files not present in source directory

### 4. Copy Phase
- Copies validated PDFs to all destinations:
  - Free: `client/public/printables/` and `public/printables/`
  - Pro: `server/private/printables/`

### 5. Verification Phase (with `--verify`)
- Verifies file sizes match source
- Computes and compares SHA-256 hashes
- Detects any corruption or incomplete copies

### Usage

**Basic sync** (incremental, validates manifest):
```bash
node scripts/sync-printables.mjs
```

**Full sync with cleanup and verification** (recommended before releases):
```bash
node scripts/sync-printables.mjs --clean --verify
```

**Cleanup only** (remove 0-byte and stale files):
```bash
node scripts/sync-printables.mjs --clean
```

### Flags

- `--clean`: Removes files from destinations that don't exist in source (plus always removes 0-byte files)
- `--verify`: Performs hash verification after copying to detect corruption

## Manifest System Benefits

✅ **Single Source of Truth**: All printable metadata lives in one TypeScript file  
✅ **Type Safety**: TypeScript interfaces prevent configuration errors  
✅ **Automatic Validation**: Sync script ensures manifest matches actual files  
✅ **No Route Updates**: Backend routes automatically consume manifest  
✅ **Normalized Filenames**: Slug-based naming prevents confusion  
✅ **Pre-Deploy Validation**: Sync script catches issues before production  

## Important Notes

- **Never** place PDFs directly in `public/printables/` or `server/private/printables/`
- Always use `assets/printables/` as the source
- **Always update manifest** when adding new PDFs
- Run `node scripts/sync-printables.mjs --clean --verify` before releases
- File sizes and hashes are verified to prevent corrupted downloads
- The sync script should be run during build/deploy processes

## Troubleshooting

**Problem**: PDF download fails with "File not found"
- **Solution**: 
  1. Check if PDF exists in `assets/printables/free/` or `assets/printables/pro/`
  2. Verify manifest entry exists in `manifest.ts`
  3. Run `node scripts/sync-printables.mjs --clean --verify`

**Problem**: Downloaded PDF shows "Failed to load PDF document"
- **Solution**: The PDF file is likely 0 bytes or corrupted
  1. Re-upload the correct file to `assets/printables/{tier}/`
  2. Run `node scripts/sync-printables.mjs --clean --verify`

**Problem**: Sync script reports "Missing PDF for manifest entry"
- **Solution**: The manifest references a file that doesn't exist
  1. Either add the missing PDF to `assets/printables/{tier}/`
  2. Or comment out/remove the manifest entry if not needed

**Problem**: Sync script reports "Orphaned PDF not in manifest"
- **Solution**: A PDF exists but isn't registered in the manifest
  1. Either add a manifest entry for it
  2. Or delete the orphaned PDF if it's no longer needed

**Problem**: Backend shows fewer printables than expected
- **Solution**: Backend filters out printables whose files don't exist
  1. Check server logs for warnings: `[Printables] Skipping X - file not synced`
  2. Run `node scripts/sync-printables.mjs --clean --verify` to fix

## Migration from Hardcoded Routes (Completed)

Previously, printables were defined in hardcoded arrays in `server/routes.ts`. The system has been refactored to use the manifest:

**Before** (Old System):
```typescript
// Hardcoded in server/routes.ts
const fileMap = {
  'camping-planner-us': 'THE CAMPING PLANNER US LETTER.pdf',
  // ... manual mapping
};
```

**After** (Current System):
```typescript
// Defined in manifest.ts
export const PRINTABLES_MANIFEST = [
  {
    slug: 'camping-planner-us-letter',
    filename: 'camping-planner-us-letter.pdf',
    // ... metadata
  },
];

// Backend routes.ts automatically loads from manifest
import { PRINTABLES_MANIFEST, getPrintableBySlug } from '../assets/printables/manifest';
```

This eliminates the need to update routes when adding printables.
