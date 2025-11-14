#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Parse command line flags
const args = process.argv.slice(2);
const CLEAN_MODE = args.includes('--clean');
const VERIFY_MODE = args.includes('--verify');

// Source directories (canonical)
const sourceFreePath = path.join(rootDir, 'assets/printables/free');
const sourceProPath = path.join(rootDir, 'assets/printables/pro');

// Destination directories
const destinations = {
  free: [
    path.join(rootDir, 'client/public/printables'),  // Dev environment
    path.join(rootDir, 'public/printables'),          // Production static
  ],
  pro: [
    path.join(rootDir, 'server/private/printables'),  // Protected endpoint
  ],
};

console.log('[Sync Printables] Starting PDF sync process...');
console.log(`[Sync Printables] Mode: ${CLEAN_MODE ? 'CLEAN' : 'INCREMENTAL'} ${VERIFY_MODE ? '+ VERIFY' : ''}\n`);

// Ensure all destination directories exist
Object.values(destinations).flat().forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[Sync Printables] Created directory: ${dir}`);
  }
});

// Calculate file hash for verification
function getFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Clean up destination directories
function cleanupDestinations(sourceDir, destDirs, label) {
  if (!fs.existsSync(sourceDir)) {
    return { removed: 0 };
  }

  const sourceFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.pdf'));
  let removedCount = 0;

  destDirs.forEach(destDir => {
    if (!fs.existsSync(destDir)) return;

    const destFiles = fs.readdirSync(destDir).filter(f => f.endsWith('.pdf'));

    destFiles.forEach(file => {
      const destPath = path.join(destDir, file);
      const stats = fs.statSync(destPath);
      
      // ALWAYS remove 0-byte files (regardless of --clean flag)
      if (stats.size === 0) {
        console.log(`[Sync Printables] 🗑️  Removing 0-byte file: ${file} from ${path.relative(rootDir, destDir)}`);
        fs.unlinkSync(destPath);
        removedCount++;
        return;
      }

      // If --clean flag, remove files not in source
      if (CLEAN_MODE && !sourceFiles.includes(file)) {
        console.log(`[Sync Printables] 🗑️  Removing stale file: ${file} from ${path.relative(rootDir, destDir)}`);
        fs.unlinkSync(destPath);
        removedCount++;
      }
    });
  });

  return { removed: removedCount };
}

// Function to copy files with verification
function syncFiles(sourceDir, destDirs, label) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`[Sync Printables] ⚠️  Source directory not found: ${sourceDir}`);
    return { copied: 0, errors: 0 };
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.pdf'));
  let copiedCount = 0;
  let errorCount = 0;

  if (files.length === 0) {
    console.log(`[Sync Printables] ⚠️  No PDF files found in ${label} directory`);
    return { copied: 0, errors: 0 };
  }

  console.log(`[Sync Printables] Found ${files.length} ${label} PDF(s)`);

  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const stats = fs.statSync(sourcePath);

    if (stats.size === 0) {
      console.error(`[Sync Printables] ❌ ERROR: Source file is empty: ${file}`);
      errorCount++;
      return;
    }

    destDirs.forEach(destDir => {
      const destPath = path.join(destDir, file);
      try {
        fs.copyFileSync(sourcePath, destPath);
        const destStats = fs.statSync(destPath);

        if (destStats.size !== stats.size) {
          console.error(`[Sync Printables] ❌ ERROR: Size mismatch for ${file}`);
          console.error(`  Source: ${stats.size} bytes, Dest: ${destStats.size} bytes`);
          errorCount++;
        } else {
          console.log(`[Sync Printables] ✓ Copied ${file} (${Math.round(stats.size / 1024)}KB) → ${path.relative(rootDir, destDir)}`);
          copiedCount++;
        }
      } catch (err) {
        console.error(`[Sync Printables] ❌ ERROR copying ${file} to ${destDir}:`, err.message);
        errorCount++;
      }
    });
  });

  return { copied: copiedCount, errors: errorCount };
}

// Verify files after sync
function verifyFiles(sourceDir, destDirs, label) {
  if (!fs.existsSync(sourceDir) || !VERIFY_MODE) {
    return { verified: 0, errors: 0 };
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.pdf'));
  let verifiedCount = 0;
  let errorCount = 0;

  console.log(`\n[Sync Printables] Verifying ${label} PDFs...`);

  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const sourceHash = getFileHash(sourcePath);
    const sourceStats = fs.statSync(sourcePath);

    destDirs.forEach(destDir => {
      const destPath = path.join(destDir, file);

      if (!fs.existsSync(destPath)) {
        console.error(`[Sync Printables] ❌ VERIFY ERROR: File missing in destination: ${file}`);
        errorCount++;
        return;
      }

      const destStats = fs.statSync(destPath);
      
      // Check for 0-byte files
      if (destStats.size === 0) {
        console.error(`[Sync Printables] ❌ VERIFY ERROR: Destination file is 0 bytes: ${file}`);
        errorCount++;
        return;
      }

      // Verify size
      if (destStats.size !== sourceStats.size) {
        console.error(`[Sync Printables] ❌ VERIFY ERROR: Size mismatch for ${file}`);
        console.error(`  Source: ${sourceStats.size} bytes, Dest: ${destStats.size} bytes`);
        errorCount++;
        return;
      }

      // Verify hash
      const destHash = getFileHash(destPath);
      if (destHash !== sourceHash) {
        console.error(`[Sync Printables] ❌ VERIFY ERROR: Hash mismatch for ${file}`);
        console.error(`  Source hash: ${sourceHash.substring(0, 16)}...`);
        console.error(`  Dest hash: ${destHash.substring(0, 16)}...`);
        errorCount++;
        return;
      }

      verifiedCount++;
    });
  });

  if (errorCount === 0 && verifiedCount > 0) {
    console.log(`[Sync Printables] ✓ All ${label} PDFs verified successfully`);
  }

  return { verified: verifiedCount, errors: errorCount };
}

// Cleanup phase
console.log('\n--- Cleanup Phase ---');
const freeCleanup = cleanupDestinations(sourceFreePath, destinations.free, 'free');
const proCleanup = cleanupDestinations(sourceProPath, destinations.pro, 'Pro');
console.log(`[Sync Printables] Removed ${freeCleanup.removed + proCleanup.removed} stale/corrupt file(s)`);

// Sync free printables
console.log('\n--- Syncing Free Printables ---');
const freeResults = syncFiles(sourceFreePath, destinations.free, 'free');

// Sync Pro printables
console.log('\n--- Syncing Pro Printables ---');
const proResults = syncFiles(sourceProPath, destinations.pro, 'Pro');

// Verification phase
const freeVerify = verifyFiles(sourceFreePath, destinations.free, 'free');
const proVerify = verifyFiles(sourceProPath, destinations.pro, 'Pro');

// Summary
console.log('\n========================================');
console.log('[Sync Printables] Summary:');
console.log(`  Files removed: ${freeCleanup.removed + proCleanup.removed}`);
console.log(`  Free PDFs copied: ${freeResults.copied}`);
console.log(`  Pro PDFs copied: ${proResults.copied}`);
if (VERIFY_MODE) {
  console.log(`  Files verified: ${freeVerify.verified + proVerify.verified}`);
  console.log(`  Verify errors: ${freeVerify.errors + proVerify.errors}`);
}
console.log(`  Total errors: ${freeResults.errors + proResults.errors + freeVerify.errors + proVerify.errors}`);
console.log('========================================\n');

// Exit with error if any files failed
const totalErrors = freeResults.errors + proResults.errors + freeVerify.errors + proVerify.errors;
if (totalErrors > 0) {
  console.error('[Sync Printables] ❌ PDF sync completed with errors!');
  process.exit(1);
}

console.log('[Sync Printables] ✅ PDF sync completed successfully!');
process.exit(0);
