import {language} from './i18n.js';

// A facility record in the reader's language (3.200.0). Chinese is the original; the English title, body and remarks come
// from content/stories/<id>.en.md, and a record without them reads Chinese. `comms` are the controllers' remarks played
// on the comms bar when the record is opened to read, as comms messages ({speaker, expression, text}).
export function storyText(story){
 const en=language()==='en'&&story?.en?story.en:null;
 const comms=(story?.comms||[]).map((c,i)=>({speaker:c.speaker,...(c.expression?{expression:c.expression}:{}),text:en?.comms?.[i]??c.text}));
 return {title:en?.title??story?.title??'',body:en?.body??story?.body??'',comms};
}
