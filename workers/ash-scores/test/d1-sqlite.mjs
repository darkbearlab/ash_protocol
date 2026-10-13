// A D1 stand-in over node:sqlite for the tests: prepare/bind/first/all/run and batch, as src/db.js uses them.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

class Statement{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.db,this.sql,args.map(v=>v instanceof Uint8Array?Buffer.from(v):v));}
 async first(){return this.db.prepare(this.sql).get(...this.args)??null;}
 async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
 async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes)}};}
}
export function memoryD1(migrations){
 const db=new DatabaseSync(':memory:');
 for(const f of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL(f,`file:///${migrations.replace(/\\/g,'/')}/`),'utf8'));
 return {raw:db,prepare:sql=>new Statement(db,sql),batch:async list=>{const out=[];for(const s of list)out.push(await s.run());return out;}};
}
