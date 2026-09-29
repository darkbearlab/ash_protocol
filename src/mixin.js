// Topic modules of a large class (3.206.3). src/game.js and src/renderer.js keep their class and its core; the methods
// of one topic live in a class of their own in another file (src/game-*.js, src/renderer-*.js), and this copies those
// methods, getters and statics onto the real class with the descriptors class syntax gives them (not enumerable), so
// `this`, `instanceof` and Renderer.prototype.x.call(...) work exactly as before. A name defined twice throws: a split
// can never shadow a method without saying so.
export function mixin(target,...sources){
 for(const source of sources){
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(source.prototype))){
   if(key==='constructor')continue;
   if(Object.hasOwn(target.prototype,key))throw new Error(`${target.name}.prototype.${key} is defined twice`);
   Object.defineProperty(target.prototype,key,d);
  }
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(source))){
   if(key==='length'||key==='name'||key==='prototype')continue;
   if(Object.hasOwn(target,key))throw new Error(`${target.name}.${key} is defined twice`);
   Object.defineProperty(target,key,d);
  }
 }
}
