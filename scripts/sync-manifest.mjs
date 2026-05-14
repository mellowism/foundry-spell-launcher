import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('./module.json', 'utf8'));

const jsPath = `dist/spell-launcher-v${pkg.version}.js`;
const cssPath = `dist/spell-launcher-v${pkg.version}.css`;

// Copy CSS into dist with versioned filename so cache can't serve stale.
// Source CSS file is authored at src/styles/spell-launcher.css; built CSS
// lives in dist/ alongside the versioned JS bundle. Same trick as JS.
const srcCss = 'src/styles/spell-launcher.css';
if (existsSync(srcCss)) {
  if (!existsSync('dist')) mkdirSync('dist', { recursive: true });
  copyFileSync(srcCss, cssPath);
}

manifest.version = pkg.version;
manifest.esmodules = [jsPath];
manifest.styles = [cssPath];

writeFileSync('./module.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ module.json synced — version=${pkg.version}, esmodules=${jsPath}, styles=${cssPath}`);
