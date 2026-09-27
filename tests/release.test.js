import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { releaseAssetUrl } from '../src/core/release.js';

test('local model requests replace stale cache keys and preserve external signed URLs', () => {
  assert.equal(releaseAssetUrl('assets/models/recruit.glb', 'new'), 'assets/models/recruit.glb?v=new');
  assert.equal(releaseAssetUrl('assets/models/recruit.glb?quality=low&v=old#mesh', 'new'), 'assets/models/recruit.glb?quality=low&v=new#mesh');
  const external = 'https://example.com/model.glb?signature=valid';
  assert.equal(releaseAssetUrl(external, 'new'), external);
  assert.equal(releaseAssetUrl('assets/models/recruit.glb', ''), 'assets/models/recruit.glb');
});

test('published entry and both relative and bare dependency URLs use the same release', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const release = html.match(/data-release="([a-f0-9]{12})"/)[1];
  const map = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
  for (const key of ['./src/core/Game.js', './src/rendering/EnvironmentKit.js', './src/core/release.js', 'three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js', './vendor/three.core.min.js']) {
    assert.ok(map[key]?.endsWith(`?v=${release}`), `Stale or missing module URL: ${key}`);
  }
  for (const file of ['styles.css', 'assets/icon.svg', 'src/main.js']) assert.ok(html.includes(`"${file}?v=${release}"`));
});
