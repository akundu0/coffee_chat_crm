/**
 * package-extension.js
 *
 * Zips exactly the files Chrome needs to load the extension
 * (manifest, src/, icons/) into dist/coffee-chat-crm.zip - handy for
 * uploading to the Chrome Web Store or sharing a build without the
 * repo's dev tooling. Requires the `zip` CLI to be on PATH.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const outFile = path.join(distDir, 'coffee-chat-crm.zip');

fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

const filesToInclude = ['manifest.json', 'src', 'icons'];
for (const f of filesToInclude) {
  if (!fs.existsSync(path.join(root, f))) {
    console.error(`Missing required file/folder before packaging: ${f}`);
    process.exit(1);
  }
}

execFileSync('zip', ['-r', outFile, ...filesToInclude], { cwd: root, stdio: 'inherit' });
console.log(`\nPackaged extension -> ${path.relative(root, outFile)}`);
