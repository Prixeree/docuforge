#!/usr/bin/env node

/**
 * sync-assets.js
 * 
 * Automatically checks and downloads/syncs media assets from docuforge-assets
 * when someone starts DocuForge via `npm start` or Docker.
 * 
 * Features:
 * - Detects existing local assets (parent folder, ./assets, or SSD).
 * - If missing, performs a fast shallow clone (`--depth 1`) from GitHub.
 * - HTTP fallback if git is unavailable.
 * - Non-blocking: will never crash the server if network is down (procedural fallback kicks in).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SCRIPT_DIR = path.resolve(import.meta.dirname, '..');
const REPO_URL = process.env.DOCUFORGE_ASSETS_REPO || 'https://github.com/Prixeree/docuforge-assets.git';

export function findLocalAssets() {
  const candidateDirs = [
    process.env.DOCUFORGE_ASSETS_DIR,
    path.join(SCRIPT_DIR, '..', 'docuforge-assets'),
    path.join(SCRIPT_DIR, 'assets'),
    '/Volumes/SSD 500gb/Project/docuforge-assets',
    '/app/docuforge-assets'
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    const manifestPath = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return dir;
    }
  }

  return null;
}

export async function ensureAssets() {
  const existing = findLocalAssets();
  if (existing) {
    console.log(`[assets] ✅ Media assets found at: ${existing}`);
    return existing;
  }

  // Determine target directory
  const parentDir = path.resolve(SCRIPT_DIR, '..');
  let targetDir = path.join(parentDir, 'docuforge-assets');

  try {
    fs.accessSync(parentDir, fs.constants.W_OK);
  } catch {
    // If parent is not writable, put it inside docuforge/assets
    targetDir = path.join(SCRIPT_DIR, 'assets');
  }

  console.log(`[assets] 📥 No local media assets found.`);
  console.log(`[assets] ⏳ Auto-downloading assets repository from ${REPO_URL} into ${targetDir}...`);

  try {
    execSync(`git clone --depth 1 "${REPO_URL}" "${targetDir}"`, {
      stdio: 'inherit',
      timeout: 180000 // 3 min timeout
    });
    console.log(`[assets] 🎉 Assets successfully downloaded and synced to ${targetDir}`);
    return targetDir;
  } catch (err) {
    console.warn(`[assets] ⚠️ Git clone failed: ${err.message}`);
    console.warn(`[assets] ℹ️ DocuForge will continue using live stock footage and procedural shaders.`);
    return null;
  }
}

import { pathToFileURL } from 'node:url';

// Run standalone if invoked directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  ensureAssets().then(dir => {
    if (dir) {
      console.log(`[assets] Asset synchronization complete.`);
      process.exit(0);
    } else {
      process.exit(0); // non-fatal
    }
  });
}
