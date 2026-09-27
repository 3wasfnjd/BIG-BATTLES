// Static GitHub Pages publishes the same paths with a ten-minute browser cache.
// Map every ES module, including relative dependencies, to a release-specific URL.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path.split(sep).join('/'));
  }
  return result;
}
const modules = [...await files('src'), ...await files('vendor')].filter(p => p.endsWith('.js')).sort();
const assets = [...await files('assets/models')].filter(p => p.endsWith('.glb'));
const runtime = [...modules, ...assets, 'styles.css', 'assets/icon.svg'].sort();
const indexPath = join(root, 'index.html'), original = await readFile(indexPath, 'utf8');
const shell = original.replace(/\sdata-release="[^"]*"/, '').replace(/(<script type="importmap">)[\s\S]*?(<\/script>)/, '$1$2')
  .replace(/(href|src)="(styles\.css|assets\/icon\.svg|src\/main\.js)(?:\?[^"]*)?"/g, '$1="$2"');
const hash = createHash('sha256');
hash.update(shell); hash.update(await readFile(new URL(import.meta.url)));
for (const path of runtime) { hash.update(path + '\0'); hash.update(await readFile(join(root, path))); hash.update('\0'); }
const release = hash.digest('hex').slice(0, 12);
const imports = { three: `./vendor/three.module.min.js?v=${release}`, 'three/addons/': './vendor/addons/' };
for (const path of modules) {
  imports[`./${path}`] = `./${path}?v=${release}`;
  // Import maps do not recursively remap a prefix result: aliases need explicit entries.
  if (path.startsWith('vendor/addons/')) imports[path.replace('vendor/addons/', 'three/addons/')] = `./${path}?v=${release}`;
}
let html = original.replace(/<html\b[^>]*>/, tag => tag.replace(/\sdata-release="[^"]*"/, '').replace('>', ` data-release="${release}">`));
html = html.replace(/(<script type="importmap">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify({ imports })}$2`);
html = html.replace(/href="styles\.css(?:\?[^"]*)?"/, `href="styles.css?v=${release}"`);
html = html.replace(/href="assets\/icon\.svg(?:\?[^"]*)?"/, `href="assets/icon.svg?v=${release}"`);
html = html.replace(/src="src\/main\.js(?:\?[^"]*)?"/, `src="src/main.js?v=${release}"`);
if (process.argv.includes('--check')) {
  if (html !== original) throw new Error('Runtime changed: run npm run release before testing or publishing.');
  console.log(`Release ${release}: ${modules.length} module URLs and local model cache keys are current.`);
} else {
  await writeFile(indexPath, html);
  console.log(`Release ${release}\nhttps://3wasfnjd.github.io/BIG-BATTLES/?v=${release}`);
}
