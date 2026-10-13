// Responses and CORS. The game calls this API from its page: GitHub Pages and itch.io's game iframe (wrangler.toml
// ALLOWED_ORIGINS; DEV_ORIGINS in .dev.vars for a local server). CORS only governs browsers: nothing here relies on it
// for safety, every check is made on the request itself.
export function allowedOrigin(env,origin){
 if(!origin)return null;
 const list=`${env.ALLOWED_ORIGINS||''},${env.DEV_ORIGINS||''}`.split(',').map(s=>s.trim()).filter(Boolean);
 return list.includes(origin)?origin:null;
}
export function corsHeaders(env,request){
 const origin=allowedOrigin(env,request.headers.get('Origin'));
 return origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}:{'Vary':'Origin'};
}
export function json(env,request,status,data,extra={}){
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(env,request),...extra}});
}
export const fail=(env,request,status,error,more={})=>json(env,request,status,{ok:false,error,...more});
