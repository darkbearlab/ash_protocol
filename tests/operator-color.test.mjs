// 3.48.2 operator colour (Claude): palette integrity and the grey-to-colour gradient used to tint class sprites.
import test from 'node:test';
import assert from 'node:assert/strict';
import {OPERATOR_COLORS,DEFAULT_OPERATOR_COLOR,validOperatorColor,operatorColor,tintPixels} from '../src/operator-color.js';

test('palette: unique ids, hex colours, one untinted option, valid default',()=>{
 assert.equal(new Set(OPERATOR_COLORS.map(c=>c.id)).size,OPERATOR_COLORS.length);
 for(const c of OPERATOR_COLORS)assert.ok(c.hex===null||/^#[0-9a-f]{6}$/.test(c.hex),c.id);
 assert.deepEqual(OPERATOR_COLORS.filter(c=>c.hex===null).map(c=>c.id),['none']);
 assert.ok(validOperatorColor(DEFAULT_OPERATOR_COLOR));
 for(const bad of [undefined,null,'','purple','__proto__'])assert.equal(validOperatorColor(bad),false);
 assert.equal(operatorColor('nope').id,DEFAULT_OPERATOR_COLOR);
});

test('tint keeps alpha and transparent pixels, darkens outlines, and is monotonic in grey',()=>{
 const greys=[16,33,58,82,115,148,181,214,239],hex=operatorColor('blue').hex,color=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const data=new Uint8ClampedArray([...greys.flatMap(v=>[v,v,v,255]),50,60,70,0]);tintPixels(data,hex);
 assert.deepEqual([...data.slice(-4)],[50,60,70,0],'transparent pixel untouched');
 const out=greys.map((_,i)=>[...data.slice(i*4,i*4+4)]);
 for(const px of out)assert.equal(px[3],255);
 for(let k=0;k<3;k++){assert.equal(out[0][k],Math.round(color[k]*.22),'outline is a deep shade');for(let i=1;i<out.length;i++)assert.ok(out[i][k]>=out[i-1][k],'monotonic');assert.ok(out.at(-1)[k]>=color[k],'highlights lighten')}
 const plain=new Uint8ClampedArray([82,82,82,255]);tintPixels(plain,null);assert.deepEqual([...plain],[82,82,82,255],'"none" leaves the grey art alone');
});
