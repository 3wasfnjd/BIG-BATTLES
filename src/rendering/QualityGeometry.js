import * as THREE from 'three';

// One reusable chamfered stone, with a flat top and broad light-catching edges.
export function chamferedStone() {
  const positions = [], indices = [];
  const outline = [[-.42,-.5],[.42,-.5],[.5,-.42],[.5,.42],[.42,.5],[-.42,.5],[-.5,.42],[-.5,-.42]];
  for (const [y, scale] of [[-.5, 1], [.12, 1], [.5, .93]]) for (const [x,z] of outline) positions.push(x * scale, y, z * scale);
  positions.push(0,.5,0);
  for (let i = 0; i < 8; i++) {
    const k = (i + 1) % 8;
    for (let ring = 0; ring < 2; ring++) {
      const a = ring * 8 + i, b = ring * 8 + k;
      indices.push(a, a+8, b+8, a, b+8, b);
    }
    indices.push(24, 16+k, 16+i);
  }
  const indexed = new THREE.BufferGeometry(); indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions,3)); indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals(); return geometry;
}

// A soft directional footprint needs one shared 72-triangle mesh, no shadow map.
export function softDirectionalShadow() {
  const count = 24, positions = [0.29,0,-0.16], colors = [1,1,1,.82], indices = [];
  for (const [scale, alpha] of [[.66,.70],[1,0]]) for (let i=0;i<count;i++) {
    const t=i/count*Math.PI*2, x=Math.cos(t)*.62*scale, z=Math.sin(t)*.33*scale;
    positions.push(.29+x*.87-z*.5,0,-.16-x*.5-z*.87); colors.push(1,1,1,alpha);
  }
  for (let i=0;i<count;i++) {
    const a=i+1,b=(i+1)%count+1;
    indices.push(0,b,a,a,b,b+count,a,b+count,a+count);
  }
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4)); geometry.setIndex(indices); return geometry;
}
