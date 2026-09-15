import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileStories,parseStory} from '../tools/stories.mjs';
const valid='---\nid: sample\ntitle: 範例\n---\n內容';
test('checked-in stories are current and validation errors name file, line and remedy',async()=>{
 await compileStories({check:true});
 for(const [text,file,options]of [[valid,'other.md'],[valid.replace('title: 範例',''),'sample.md'],[valid.replace('title: 範例','title: 範例\nfaction: invalid'),'sample.md'],[valid.replace('title: 範例','title: 範例\nfloors: 6-1'),'sample.md'],[valid,'sample.md',{retired:['sample']}],[valid,'sample.md',{banned:['內容']}],[valid+'x'.repeat(12000),'sample.md']])assert.throws(()=>parseStory(text,file,options),new RegExp(`${file}:\\d+:`));
});
test('deleted IDs require retirement, cannot be reused, and stale output fails',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'ash-stories-')),output=join(directory,'out.js');
 try{for(const name of ['_retired.txt','_banned-words.txt'])await writeFile(join(directory,name),'');await writeFile(join(directory,'sample.md'),valid);await compileStories({directory,output});await writeFile(join(directory,'sample.md'),valid+'新內容');await assert.rejects(compileStories({directory,output,check:true}),/npm run stories/);await rm(join(directory,'sample.md'));await assert.rejects(compileStories({directory,output}),/_retired.txt:1/);await writeFile(join(directory,'_retired.txt'),'sample');await compileStories({directory,output});await writeFile(join(directory,'sample.md'),valid);await assert.rejects(compileStories({directory,output}),/已停用/);}finally{await rm(directory,{recursive:true});}
});
