#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Parse command line flags
const args = process.argv.slice(2);
const CLEAN_MODE = args.includes('--clean');
const VERIFY_MODE = args.includes('--verify');

console.log('[Sync Printables] Starting PDF sync process...');
const modeLabel = CLEAN_MODE ? 'CLEAN' : 'INCREMENTAL';
const verifyLabel = VERIFY_MODE ? '+ VERIFY' : '';
console.log('[Sync Printables] Mode:', modeLabel, verifyLabel, '\n');

// Compile and load manifest
console.log('[Sync Printables] Loading printables manifest...');
let PRINTABLES_MANIFEST;
try {
  const manifestPath = path.join(rootDir, 'assets/printables/manifest.ts');
  const tsxCmd = 'npx tsx -e "import { PRINTABLES_MANIFEST } from \'' + manifestPath + '\'; console.log(JSON.stringify(PRINTABLES_MANIFEST));"';
  const { stdout } = await execAsync(tsxCmd, { cwd: rootDir });
  PRINTABLES_MANIFEST = JSON.parse(stdout.trim());
  console.log('[Sync Printables] Loaded ' + PRINTABLES_MANIFEST.length + ' printable(s) from manifest\n');
} catch (error) {
  console.error('[Sync Printables] Failed to load manifest:', error.message);
  process.exit(1);
}

// Source directories (canonical)
const sourceFreePath = path.join(rootDir, 'assets/printables/free');
const sourceProPath = path.join(rootDir, 'assets/printables/pro');

// Destination directories
const destinations = {
  free: [
    path.join(rootDir, 'client/public/printables'),
    path.join(rootDir, 'public/printables'),
  ],
  pro: [
    path.join(rootDir, 'server/private/printables'),
  ],
};

// Ensure all destination directories exist
Object.values(destinations).flat().forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('[Sync Printables] Created directory:', dir);
  }
});

// Calculate file hash for verification
function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Validate manifest against actual files
console.log('--- Manifest Validation ---');
let manifestErrors = 0;
const manifestFiles = new Set();

PRINTABLES_MANIFEST.forEach(entry => {
  const sourceDir = entry.tier === 'free' ? sourceFreePath : sourceProPath;
  const filePath = path.join(sourceDir, entry.filename);
  manifestFiles.add(entry.filename);
  
  if (!fs.existsSync(filePath)) {
    console.error('[Sync Printables] MANIFEST ERROR: File not found for "' + entry.slug + '": ' + entry.filename);
    console.error('   Expected location:', filePath);
    manifestErrors++;
  } else {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.error('[Sync Printables] MANIFEST ERROR: File is 0 bytes for "' + entry.slug + '": ' + entry.filename);
      manifestErrors++;
    } else {
      const sizeKB = Math.round(stats.size / 1024);
      console.log('[Sync Printables] Validated ' + entry.slug + ': ' + entry.filename + ' (' + sizeKB + 'KB)');
    }
  }
});

// Check for orphaned files
console.log('\n--- Orphaned File Detection ---');
let orphanedCount = 0;

[sourceFreePath, sourceProPath].forEach(dir => {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  files.forEach(file => {
    if (!manifestFiles.has(file)) {
      console.warn('[Sync Printables] WARNING: Orphaned PDF not in manifest: ' + file);
      console.warn('   Add this file to assets/printables/manifest.ts or remove it');
      orphanedCount++;
    }
  });
});

if (orphanedCount === 0) {
  console.log('[Sync Printables] No orphaned files found');
}

console.log('\n[Sync Printables] Manifest validation: ' + manifestErrors + ' error(s), ' + orphanedCount + ' warning(s)');

if (manifestErrors > 0) {
  console.error('\n[Sync Printables] Manifest validation failed!');
  console.error('Fix manifest errors before syncing PDFs.');
  process.exit(1);
}

// Clean up destination directories
function cleanupDestinations(tier) {
  const manifestFilesForTier = PRINTABLES_MANIFEST
    .filter(p => p.tier === tier)
    .map(p => p.filename);
  
  const destDirs = destinations[tier];
  let removedCount = 0;

  destDirs.forEach(destDir => {
    if (!fs.existsSync(destDir)) return;

    const destFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.pdf'));

    destFiles.forEach(file => {
      const destPath = path.join(destDir, file);
      const stats = fs.statSync(destPath);
      
      if (stats.size === 0) {
        console.log('[Sync Printables] Removing 0-byte file: ' + file + ' from ' + path.relative(rootDir, destDir));
        fs.unlinkSync(destPath);
        removedCount++;
        return;
      }

      if (CLEAN_MODE && !manifestFilesForTier.includes(file)) {
        console.log('[Sync Printables] Removing stale file: ' + file + ' from ' + path.relative(rootDir, destDir));
        fs.unlinkSync(destPath);
        removedCount++;
      }
    });
  });

  return { removed: removedCount };
}

// Sync files from manifest
function syncFiles(tier) {
  const printablesForTier = PRINTABLES_MANIFEST.filter(p => p.tier === tier);
  const sourceDir = tier === 'free' ? sourceFreePath : sourceProPath;
  const destDirs = destinations[tier];
  
  let copiedCount = 0;
  let errorCount = 0;

  if (printablesForTier.length === 0) {
    console.log('[Sync Printables] No ' + tier + ' PDFs in manifest');
    return { copied: 0, errors: 0 };
  }

  console.log('[Sync Printables] Syncing ' + printablesForTier.length + ' ' + tier + ' PDF(s)...');

  printablesForTier.forEach(entry => {
    const sourcePath = path.join(sourceDir, entry.filename);
    const stats = fs.statSync(sourcePath);

    destDirs.forEach(destDir => {
      const destPath = path.join(destDir, entry.filename);
      try {
        fs.copyFileSync(sourcePath, destPath);
        const destStats = fs.statSync(destPath);

        if (destStats.size !== stats.size) {
          console.error('[Sync Printables] ERROR: Size mismatch for ' + entry.filename);
          console.error('  Source: ' + stats.size + ' bytes, Dest: ' + destStats.size + ' bytes');
          errorCount++;
        } else {
          const sizeKB = Math.round(stats.size / 1024);
          console.log('[Sync Printables] Copied ' + entry.filename + ' (' + sizeKB + 'KB) to ' + path.relative(rootDir, destDir));
          copiedCount++;
        }
      } catch (err) {
        console.error('[Sync Printables] ERROR copying ' + entry.filename + ' to ' + destDir + ':', err.message);
        errorCount++;
      }
    });
  });

  return { copied: copiedCount, errors: errorCount };
}

// Verify files after sync
function verifyFiles(tier) {
  if (!VERIFY_MODE) {
    return { verified: 0, errors: 0 };
  }

  const printablesForTier = PRINTABLES_MANIFEST.filter(p => p.tier === tier);
  const sourceDir = tier === 'free' ? sourceFreePath : sourceProPath;
  const destDirs = destinations[tier];
  
  let verifiedCount = 0;
  let errorCount = 0;

  console.log('\n[Sync Printables] Verifying ' + tier + ' PDFs...');

  printablesForTier.forEach(entry => {
    const sourcePath = path.join(sourceDir, entry.filename);
    const sourceHash = getFileHash(sourcePath);
    const sourceStats = fs.statSync(sourcePath);

    destDirs.forEach(destDir => {
      const destPath = path.join(destDir, entry.filename);

      if (!fs.existsSync(destPath)) {
        console.error('[Sync Printables] VERIFY ERROR: File missing in destination: ' + entry.filename);
        errorCount++;
        return;
      }

      const destStats = fs.statSync(destPath);
      
      if (destStats.size === 0) {
        console.error('[Sync Printables] VERIFY ERROR: Destination file is 0 bytes: ' + entry.filename);
        errorCount++;
        return;
      }

      if (destStats.size !== sourceStats.size) {
        console.error('[Sync Printables] VERIFY ERROR: Size mismatch for ' + entry.filename);
        console.error('  Source: ' + sourceStats.size + ' bytes, Dest: ' + destStats.size + ' bytes');
        errorCount++;
        return;
      }

      const destHash = getFileHash(destPath);
      if (destHash !== sourceHash) {
        console.error('[Sync Printables] VERIFY ERROR: Hash mismatch for ' + entry.filename);
        errorCount++;
        return;
      }

      verifiedCount++;
    });
  });

  if (errorCount === 0 && verifiedCount > 0) {
    console.log('[Sync Printables] All ' + tier + ' PDFs verified successfully');
  }

  return { verified: verifiedCount, errors: errorCount };
}

// Cleanup phase
console.log('\n--- Cleanup Phase ---');
const freeCleanup = cleanupDestinations('free');
const proCleanup = cleanupDestinations('pro');
console.log('[Sync Printables] Removed ' + (freeCleanup.removed + proCleanup.removed) + ' stale/corrupt file(s)');

// Sync free printables
console.log('\n--- Syncing Free Printables ---');
const freeResults = syncFiles('free');

// Sync Pro printables
console.log('\n--- Syncing Pro Printables ---');
const proResults = syncFiles('pro');

// Verification phase
const freeVerify = verifyFiles('free');
const proVerify = verifyFiles('pro');

// Summary
console.log('\n========================================');
console.log('[Sync Printables] Summary:');
console.log('  Manifest entries: ' + PRINTABLES_MANIFEST.length);
console.log('  Files removed: ' + (freeCleanup.removed + proCleanup.removed));
console.log('  Free PDFs copied: ' + freeResults.copied);
console.log('  Pro PDFs copied: ' + proResults.copied);
if (VERIFY_MODE) {
  console.log('  Files verified: ' + (freeVerify.verified + proVerify.verified));
  console.log('  Verify errors: ' + (freeVerify.errors + proVerify.errors));
}
console.log('  Total errors: ' + (freeResults.errors + proResults.errors + freeVerify.errors + proVerify.errors));
console.log('========================================\n');

// Exit with error if any files failed
const totalErrors = freeResults.errors + proResults.errors + freeVerify.errors + proVerify.errors;
if (totalErrors > 0) {
  console.error('[Sync Printables] PDF sync completed with errors!');
  process.exit(1);
}

console.log('[Sync Printables] PDF sync completed successfully!');
process.exit(0);
