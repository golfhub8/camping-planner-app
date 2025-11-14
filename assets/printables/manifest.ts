/**
 * Printables Manifest
 * 
 * This is the single source of truth for all printable PDFs.
 * - Backend consumes this to generate API responses
 * - Sync script validates actual files against this manifest
 * - Adding a new printable? Add it here first, then run sync script
 */

export interface PrintableManifestEntry {
  /** Unique slug/ID for API endpoints */
  slug: string;
  
  /** Display title shown to users */
  title: string;
  
  /** Brief description */
  description: string;
  
  /** Actual PDF filename (must exist in assets/printables/{tier}/) */
  filename: string;
  
  /** Access tier */
  tier: 'free' | 'pro';
  
  /** Paper size variant */
  paperSize: 'US Letter' | 'A4';
  
  /** Icon hint for UI */
  icon?: 'planner' | 'games' | 'activities';
}

/**
 * Master Printables Catalog
 * 
 * Add new printables here. The sync script will validate that
 * the filename exists in assets/printables/{tier}/ before deployment.
 */
export const PRINTABLES_MANIFEST: PrintableManifestEntry[] = [
  // ========== FREE PRINTABLES ==========
  {
    slug: 'free-charades',
    title: 'Free Camping Charades (US Letter)',
    description: 'A fun, family-friendly game for the campfire.',
    filename: 'free-charades-us-letter.pdf',
    tier: 'free',
    paperSize: 'US Letter',
    icon: 'games',
  },
  
  // ========== PRO PRINTABLES ==========
  {
    slug: 'camping-games-a4',
    title: 'Camping Games (A4)',
    description: 'A collection of printable games for every age.',
    filename: 'camping-games-a4.pdf',
    tier: 'pro',
    paperSize: 'A4',
    icon: 'games',
  },
  {
    slug: 'mega-activity-book',
    title: 'Mega Camping Activity Book (US Letter)',
    description: 'Over 70 pages of fun activities for kids and families.',
    filename: 'mega-activity-book-us-letter.pdf',
    tier: 'pro',
    paperSize: 'US Letter',
    icon: 'activities',
  },
  
  // ========== ADDITIONAL PRO PRINTABLES ==========
  {
    slug: 'camping-planner-us-letter',
    title: 'The Camping Planner (US Letter)',
    description: 'The original planner to organize every camping trip.',
    filename: 'camping-planner-us-letter.pdf',
    tier: 'pro',
    paperSize: 'US Letter',
    icon: 'planner',
  },
  {
    slug: 'camping-planner-a4',
    title: 'The Camping Planner (A4)',
    description: 'A4 version of the core planner.',
    filename: 'camping-planner-a4.pdf',
    tier: 'pro',
    paperSize: 'A4',
    icon: 'planner',
  },
  {
    slug: 'ultimate-planner-us-letter',
    title: 'The ULTIMATE Camping Planner (US Letter)',
    description: 'All-in-one planner bundle for serious campers.',
    filename: 'ultimate-planner-us-letter.pdf',
    tier: 'pro',
    paperSize: 'US Letter',
    icon: 'planner',
  },
  {
    slug: 'games-bundle-us-letter',
    title: 'Camping Games Bundle (US Letter)',
    description: 'Complete collection of camping games.',
    filename: 'games-bundle-us-letter.pdf',
    tier: 'pro',
    paperSize: 'US Letter',
    icon: 'games',
  },
];

/**
 * Helper: Get printable by slug
 */
export function getPrintableBySlug(slug: string): PrintableManifestEntry | undefined {
  return PRINTABLES_MANIFEST.find(p => p.slug === slug);
}

/**
 * Helper: Get all printables for a tier
 */
export function getPrintablesByTier(tier: 'free' | 'pro'): PrintableManifestEntry[] {
  return PRINTABLES_MANIFEST.filter(p => p.tier === tier);
}

/**
 * Helper: Build file path for a printable
 */
export function getPrintableFilePath(entry: PrintableManifestEntry, rootDir: string): string {
  const subdir = entry.tier === 'free' ? 'free' : 'pro';
  return `${rootDir}/assets/printables/${subdir}/${entry.filename}`;
}
