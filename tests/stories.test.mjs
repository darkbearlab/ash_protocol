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
// 3.200.0: the controllers' remarks after `=== COMMS ===`, and the English file beside the Chinese one.
test('remarks name a speaker and a face the comms bar knows, and the English file mirrors them',async()=>{
 const withComms=valid+'\n\n=== COMMS ===\negret/serious: 第一句\n\noverseer: 第二句\n';
 const s=parseStory(withComms,'sample.md');
 assert.equal(s.body,'內容');
 assert.deepEqual(s.comms,[{speaker:'egret',expression:'serious',text:'第一句'},{speaker:'overseer',text:'第二句'}]);
 for(const bad of ['egret/grin: 白鷺沒畫這個表情','nobody/serious: 誰','overseer/serious: 監視官沒有臉','egret/serious:','白鷺: 格式不對'])assert.throws(()=>parseStory(valid+'\n=== COMMS ===\n'+bad,'sample.md'),/sample\.md:\d+:/,bad);
 const en='---\nid: sample\ntitle: Sample\n---\nText\n\n=== COMMS ===\negret/serious: First\noverseer: Second\n';
 const directory=await mkdtemp(join(tmpdir(),'ash-stories-')),output=join(directory,'out.js');
 try{
  for(const name of ['_retired.txt','_banned-words.txt'])await writeFile(join(directory,name),'');
  await writeFile(join(directory,'sample.md'),withComms);await writeFile(join(directory,'sample.en.md'),en);
  const [entry]=await compileStories({directory,output});
  assert.deepEqual(entry.en,{title:'Sample',body:'Text',comms:['First','Second']});
  await writeFile(join(directory,'sample.en.md'),en.replace('overseer: Second\n',''));
  await assert.rejects(compileStories({directory,output}),/sample\.en\.md:\d+: .*一樣多/);
  await writeFile(join(directory,'sample.en.md'),en.replace('egret/serious','wren/serious'));
  await assert.rejects(compileStories({directory,output}),/sample\.en\.md/);
  await writeFile(join(directory,'orphan.en.md'),en.replace('id: sample','id: orphan'));await writeFile(join(directory,'sample.en.md'),en);
  await assert.rejects(compileStories({directory,output}),/orphan\.en\.md:\d+: 找不到對應的中文檔/);
 }finally{await rm(directory,{recursive:true});}
});
