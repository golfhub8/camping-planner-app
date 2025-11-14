# Printables Asset Management

This directory is the **single source of truth** for all PDF printables in The Camping Planner app.

## Directory Structure

```
assets/printables/
├── free/          # Free printables (accessible to all users)
└── pro/           # Pro printables (requires Pro membership)
```

## How It Works

1. **Add PDFs here**: Place new PDF files in the appropriate subdirectory (`free/` or `pro/`)
2. **Run sync script**: Execute `node scripts/sync-printables.mjs` to distribute PDFs
3. **Files are copied to**:
   - Free PDFs → `client/public/printables/` (dev) and `public/printables/` (production)
   - Pro PDFs → `server/private/printables/` (protected API endpoint)

## Adding New Printables

### Step 1: Add PDF to Assets
Place your PDF file in the appropriate directory:
- `assets/printables/free/` - for free printables
- `assets/printables/pro/` - for Pro printables

### Step 2: Update Route Configuration
Edit `server/routes.ts` and add the file mapping:

For **Pro printables**, update the `fileMap` in `/api/printables/download/:id`:
```typescript
const fileMap: Record<string, string> = {
  'camping-planner-us': 'THE CAMPING PLANNER US LETTER.pdf',
  'your-new-printable': 'YOUR NEW PDF FILENAME.pdf',  // Add here
  // ...
};
```

For **Free printables**, update the printables list in `/api/printables/downloads`:
```typescript
{
  id: "your-new-free-printable",
  title: "Your Free Printable Title",
  file: "/printables/YOUR FREE PDF FILENAME.pdf",  // Must match filename
  free: true,
  description: "Description here"
}
```

### Step 3: Run Sync Script
```bash
node scripts/sync-printables.mjs
```

### Step 4: Restart the Application
The PDFs will now be available for download.

## Current Printables

### Free Printables (in `assets/printables/free/`)
- ✅ FREE CAMPING CHARADES US LETTER.pdf (133KB)

### Pro Printables (in `assets/printables/pro/`)
- ✅ CAMPING GAMES A4.pdf (9.2MB)
- ✅ MEGA CAMPING ACTIVITY BOOK US LETTER.pdf (11MB)

### Missing Pro Printables
The following Pro printables are referenced in the code but **not yet uploaded**:
- ❌ THE CAMPING PLANNER US LETTER.pdf
- ❌ THE CAMPING PLANNER A4 SIZE.pdf
- ❌ THE ULTIMATE CAMPING PLANNER US LETTER.pdf
- ❌ CAMPING GAMES BUNDLE US LETTER.pdf (different from CAMPING GAMES A4.pdf)

**Action Required**: Upload these PDF files to `assets/printables/pro/` and run the sync script.

## Sync Script Details

The sync script (`scripts/sync-printables.mjs`) performs the following:
1. **Cleanup Phase**: Removes stale and corrupted files
   - ALWAYS removes 0-byte files (regardless of flags)
   - With `--clean`: Removes files not present in source directory
2. **Copy Phase**: Copies valid PDFs to all destinations
   - Verifies source PDFs exist and are not empty
   - Copies to client/public, public, and server/private as needed
3. **Verification Phase** (optional with `--verify`):
   - Verifies file sizes match
   - Verifies file hashes match (SHA-256)
   - Detects any corruption or incomplete copies

### Usage

**Basic sync** (incremental, keeps existing non-source files):
```bash
node scripts/sync-printables.mjs
```

**Full sync with cleanup** (recommended before releases):
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

This ensures **zero-byte files are never deployed** and destinations always mirror the canonical source.

## Important Notes

- **Never** place PDFs directly in `public/printables/` or `server/private/printables/`
- Always use `assets/printables/` as the source
- Run the sync script after adding new PDFs
- The sync script should be run during build/deploy processes
- File sizes are verified to prevent corrupted downloads

## Troubleshooting

**Problem**: PDF download fails with "File not found"
- **Solution**: Check if the PDF exists in `assets/printables/free/` or `assets/printables/pro/`, then run sync script

**Problem**: Downloaded PDF shows "Failed to load PDF document"
- **Solution**: The PDF file is likely 0 bytes. Re-upload the correct file to `assets/printables/` and run sync script

**Problem**: Sync script reports errors
- **Solution**: Check that source PDFs are valid, non-empty files with proper permissions
