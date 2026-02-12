/**
 * Bump version across all config files.
 * Usage: node scripts/bump-version.js <new-version>
 * Example: npm run bump 1.0.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: node scripts/bump-version.js <new-version>');
  console.error('Example: npm run bump 1.0.0');
  process.exit(1);
}

// Validate semver-like format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version format: "${newVersion}". Expected format: X.Y.Z`);
  process.exit(1);
}

const files = [
  {
    path: resolve(root, 'package.json'),
    update(content) {
      const json = JSON.parse(content);
      json.version = newVersion;
      return JSON.stringify(json, null, 2) + '\n';
    },
  },
  {
    path: resolve(root, 'src-tauri/tauri.conf.json'),
    update(content) {
      const json = JSON.parse(content);
      json.version = newVersion;
      return JSON.stringify(json, null, 2) + '\n';
    },
  },
  {
    path: resolve(root, 'src-tauri/Cargo.toml'),
    update(content) {
      return content.replace(
        /^version\s*=\s*"[^"]*"/m,
        `version = "${newVersion}"`
      );
    },
  },
  {
    path: resolve(root, '.github/workflows/release.yml'),
    update(content) {
      return content.replace(
        /default:\s*'v[^']*'/,
        `default: 'v${newVersion}'`
      );
    },
  },
];

for (const file of files) {
  try {
    const content = readFileSync(file.path, 'utf-8');
    const updated = file.update(content);
    writeFileSync(file.path, updated, 'utf-8');
    console.log(`Updated: ${file.path}`);
  } catch (err) {
    console.error(`Failed to update ${file.path}: ${err.message}`);
  }
}

console.log(`\nVersion bumped to ${newVersion}`);
