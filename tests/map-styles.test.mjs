import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as themes from '../src/themes.js';
import * as walls from '../src/walls.js';
import * as barriers from '../src/barrier-art.js';
import {styleContract} from '../qa/map-style-contract.mjs';
import {MAP_STYLES,KILLHOUSE_ATLAS,styleSprite} from '../src/map-styles.js';
test('facility raster inputs and drawing commands exactly match 8eaff9c',()=>{
 const expected=JSON.parse(readFileSync(new URL('./fixtures/facility-art-3.86.0.json',import.meta.url)));
 assert.deepEqual(styleContract({themes,walls,barriers}),expected);
});
test('kill house has one tile per role, same floor for every room theme, separate walls and door states',()=>{
 const g={mapStyle:'killhouse',props:[],rooms:[]};for(const theme of Object.keys(themes.THEMES))assert.deepEqual(themes.resolveSprite(theme,'floor',g),styleSprite(g,'floor'));
 assert.equal(themes.themeAt(g,{x:1,y:1}),'industrial');assert.equal(Object.keys(MAP_STYLES.killhouse.materials).length,8);
 for(const role of Object.keys(MAP_STYLES.killhouse.materials))assert.equal(styleSprite(g,role).url,KILLHOUSE_ATLAS);
 assert.equal(styleSprite({mapStyle:'unknown'},'floor'),null);
 const calls=[],c={save(){},restore(){},fillRect(){},drawImage(...args){calls.push(args);}},image={complete:true,naturalWidth:128},images=new Map([[KILLHOUSE_ATLAS,image]]);
 for(const [open,hp,face]of [[false,50,[96,0]],[true,50,[32,32]],[false,0,[0,32]]]){calls.length=0;barriers.drawDoor(c,{axis:'y',open,hp},{x:50,y:50},32,images,g);assert.deepEqual(calls[0].slice(1,3),face);}
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert.ok(sw.includes('./assets/pixel/killhouse-v1/atlas.png'));
});
