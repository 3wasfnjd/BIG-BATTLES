import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { qualityCameraPose } from '../src/rendering/QualityCameraRig.js';
import { visualProfile, QUALITY_CHARACTERS, ARCADE_CHARACTERS } from '../src/rendering/VisualProfiles.js';
import { EnvironmentFactory } from '../src/rendering/EnvironmentFactory.js';
import { CharacterVisualFactory } from '../src/rendering/CharacterVisualFactory.js';
import { EffectsRenderer } from '../src/rendering/EffectsRenderer.js';
import { PlayerArmy } from '../src/entities/PlayerArmy.js';
import { EnemyHorde } from '../src/entities/EnemyHorde.js';
import { CHARACTERS } from '../src/data/characters.js';

test('closer camera contains growth rows, both gate choices and boss at mobile/landscape ratios', () => {
  for (const aspect of [0.42,390/844,1,844/390]) for (const count of [6,32,50,100,200,320]) for (const side of [-1,0,1]) for (const gateZ of [0,7,14]) {
    const army=new PlayerArmy(count), center=side*army.limit;
    const boss={type:'giantBoss',alive:true,x:0,z:12,radius:1.4};
    const pose=qualityCameraPose(0,army.depth,army.halfWidth,center,aspect,[boss],[{z:gateZ,used:false}]);
    const camera=new THREE.PerspectiveCamera(45,aspect,.1,160);
    camera.position.set(pose.x,pose.height,pose.z); camera.lookAt(pose.targetX,pose.targetY,pose.targetZ); camera.updateMatrixWorld();
    const points=[];
    for(const unit of army.units) for(const y of [0,1.9]) points.push([center+unit.formationSlot.x,y,-unit.formationSlot.z+.8]);
    for(const x of [-6.8,6.8]) for(const y of [0,2.6]) points.push([x,y,-14]);
    for(const x of [-6.8,6.8]) for(const y of [0,2.6]) points.push([x,y,-gateZ]);
    points.push([boss.x,4.4,-boss.z]);
    for(const position of points) {
      const point=new THREE.Vector3(...position).project(camera);
      assert.ok(Math.abs(point.x)<=.881 && Math.abs(point.y)<=.761 && Math.abs(point.z)<1, `aspect ${aspect}, army ${count}, side ${side}: ${point.toArray()}`);
    }
  }
});

test('quality profile changes only visual paths and stays opt-in', () => {
  assert.equal(visualProfile('').quality,false);
  assert.equal(visualProfile('').arcade,true);
  assert.equal(visualProfile('?quality=1').quality,true);
  assert.equal(visualProfile('?quality=1').arcade,false);
  assert.equal(visualProfile('?classic=1').definitions,CHARACTERS);
  assert.equal(visualProfile('?quality=0').definitions,ARCADE_CHARACTERS);
  for(const key of Object.keys(CHARACTERS)) for(const field of ['team','health','speed','radius','weapon','damage','range']) {
    assert.equal(QUALITY_CHARACTERS[key][field],CHARACTERS[key][field]);
    assert.equal(ARCADE_CHARACTERS[key][field],CHARACTERS[key][field]);
  }
  assert.equal(CHARACTERS.recruit.modelUrl,'assets/models/recruit.glb');
});

test('candidate recruit has real AO geometry and all five clips in a shared crowd batch', async () => {
  const bytes=await readFile(new URL('../assets/models/quality/recruit.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.deepEqual(gltf.animations.map(c=>c.name).sort(),['death','hit','idle','run','shoot']);
  let triangles=0; const materials=new Set();
  gltf.scene.traverse(o=>{if(o.isMesh){triangles+=o.geometry.index.count/3; materials.add(o.material); assert.ok(o.geometry.attributes.color); assert.equal(o.material.map,null);}});
  assert.equal(triangles,3384); assert.equal(materials.size,1); assert.ok(bytes.byteLength<300000);
  const scene=new THREE.Scene(), visuals=new CharacterVisualFactory(scene,{loadModels:false,quality:true,definitions:QUALITY_CHARACTERS}),army=new PlayerArmy(320);
  visuals.assets.models.set(QUALITY_CHARACTERS.recruit.modelUrl,Promise.resolve(gltf));
  await visuals.loadReplacement(visuals.batches.get('recruit'),QUALITY_CHARACTERS.recruit);
  for(const unit of army.units){unit.state='run';unit.moving=true;}
  visuals.update(army.units,[],1,1/60);
  assert.equal(visuals.batches.get('recruit').count,319);
  assert.equal(visuals.batches.get('recruit').animated,null);
  assert.equal(visuals.shadows.count,320);
  assert.equal(visuals.shadows.geometry.attributes.color.itemSize,4);
});

test('beveled road remains a bounded reusable kit with shadows above its surface', () => {
  const bytes=[];
  for(const length of [270,1080]){
    const scene=new THREE.Scene(),environment=new EnvironmentFactory(scene,length,{quality:true});
    const geometries=new Set(); scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    bytes.push([...geometries].reduce((sum,g)=>sum+(g.index?.array.byteLength||0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),0));
    const road=environment.kit.get('road'); road.computeBoundingBox();
    assert.ok(road.boundingBox.max.y<.005); assert.ok(road.boundingBox.max.x<=7 && road.boundingBox.min.x>=-7);
    for(const z of [0,16,150,270,0]) {environment.update(z); for(const {mesh} of environment.batches.values())assert.ok(mesh.count<=mesh.instanceMatrix.count);}
  }
  assert.equal(bytes[0],bytes[1]); assert.ok(bytes[0]<500000);
});

test('muzzle flashes remain pooled at 740 shooters, vanish after cooldown and clear on replay', () => {
  const scene=new THREE.Scene(),effects=new EffectsRenderer(scene,{quality:true}),army=new PlayerArmy(320),enemies=new EnemyHorde(420,12).units;
  for(const roster of [army.units,enemies])for(const unit of roster)unit.shotFlash=.1;
  effects.update([],army,enemies,1/60,1); assert.equal(effects.muzzles.count,740);
  const objectCount=scene.children.length;
  for(const roster of [army.units,enemies])for(const unit of roster)unit.shotFlash=0;
  effects.update([],army,enemies,1/60,2); assert.equal(effects.muzzles.count,0);assert.equal(effects.muzzles.visible,false);
  effects.clear();assert.equal(effects.muzzles.count,0);assert.equal(scene.children.length,objectCount);
});
