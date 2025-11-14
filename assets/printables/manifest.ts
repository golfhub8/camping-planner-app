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
  
  // ========== COMING SOON (Upload PDFs to assets/printables/pro/) ==========
  // Uncomment these after uploading the actual PDF files:
  
  // {
  //   slug: 'camping-planner-us',
  //   title: 'The Camping Planner (US Letter)',
  //   description: 'The original planner to organize every camping trip.',
  //   filename: 'THE CAMPING PLANNER US LETTER.pdf',
  //   tier: 'pro',
  //   paperSize: 'US Letter',
  //   icon: 'planner',
  // },
  // {
  //   slug: 'camping-planner-a4',
  //   title: 'The Camping Planner (A4)',
  //   description: 'A4 version of the core planner.',
  //   filename: 'THE CAMPING PLANNER A4 SIZE.pdf',
  //   tier: 'pro',
  //   paperSize: 'A4',
  //   icon: 'planner',
  // },
  // {
  //   slug: 'ultimate-planner',
  //   title: 'The ULTIMATE Camping Planner',
  //   description: 'All-in-one planner bundle for serious campers.',
  //   filename: 'THE ULTIMATE CAMPING PLANNER US LETTER.pdf',
  //   tier: 'pro',
  //   paperSize: 'US Letter',
  //   icon: 'planner',
  // },
  // {
  //   slug: 'games-bundle',
  //   title: 'Camping Games Bundle (US Letter)',
  //   description: 'Complete collection of camping games.',
  //   filename: 'CAMPING GAMES BUNDLE US LETTER.pdf',
  //   tier: 'pro',
  //   paperSize: 'US Letter',
  //   icon: 'games',
  // },
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
