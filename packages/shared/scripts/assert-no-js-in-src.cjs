const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const BLOCKED_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

if (!fs.existsSync(SRC_DIR)) {
  console.error(`[shared-guard] src directory not found: ${SRC_DIR}`);
  process.exit(1);
}

const offenders = walkFiles(SRC_DIR)
  .filter((filePath) => BLOCKED_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
  .map((filePath) => path.relative(path.resolve(__dirname, '..'), filePath));

if (offenders.length > 0) {
  console.error('[shared-guard] JavaScript artifacts are not allowed in packages/shared/src.');
  console.error('[shared-guard] Remove these files before committing:');
  for (const offender of offenders) {
    console.error(`  - ${offender}`);
  }
  process.exit(1);
}

console.log('[shared-guard] OK: no JavaScript artifacts found in src/.');
