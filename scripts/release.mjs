#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};
const capture = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); }
  catch { return null; }
};

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const tag = `v${pkg.version}`;

console.log(`\n=== Releasing ${tag} ===`);

const branch = capture('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`✗ Not on main (current: ${branch}). Aborting.`);
  process.exit(1);
}

const localTag = capture(`git rev-parse ${tag} 2>/dev/null`);
if (localTag) {
  console.error(`✗ Tag ${tag} already exists locally. Bump package.json version first.`);
  process.exit(1);
}
const remoteTag = capture(`git ls-remote --tags origin refs/tags/${tag}`);
if (remoteTag) {
  console.error(`✗ Tag ${tag} already exists on origin. Bump package.json version first.`);
  process.exit(1);
}

const changelog = readFileSync('./CHANGELOG.md', 'utf8');
if (!changelog.includes(`[${pkg.version}]`)) {
  console.error(`✗ CHANGELOG.md has no [${pkg.version}] entry.`);
  process.exit(1);
}

run('npm run build');
run('powershell -ExecutionPolicy Bypass -File scripts/build-zip.ps1');

const status = capture('git status --porcelain');
if (status) {
  run('git add -A');
  try { run(`git commit -m "${tag} — release"`); } catch (_) { /* no-op if nothing to commit */ }
}
run('git push origin main');

const versionSection = (() => {
  const m = changelog.match(new RegExp(`## \\[${pkg.version}\\][\\s\\S]*?(?=\\n## \\[|$)`));
  return m ? m[0].trim() : `Release ${tag}.`;
})();
const notesFile = './release-notes-tmp.md';
import('node:fs').then(fs => {
  fs.writeFileSync(notesFile, versionSection);
  try {
    run(`gh release create ${tag} foundry-spell-launcher.zip --title "${tag}" --notes-file ${notesFile}`);
  } finally {
    fs.unlinkSync(notesFile);
  }
  console.log(`\n✓ Released ${tag}`);
  console.log(`  https://github.com/mellowism/foundry-spell-launcher/releases/tag/${tag}`);
});
