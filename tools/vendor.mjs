import { mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const files = ['build/three.module.min.js', 'build/three.core.min.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'examples/jsm/utils/SkeletonUtils.js', 'LICENSE'];
for (const file of files) {
  const dest = new URL('vendor/' + file.replace('build/', '').replace('examples/jsm/', 'addons/'), root);
  await mkdir(new URL('./', dest), { recursive: true });
  await copyFile(new URL('node_modules/three/' + file, root), dest);
}
