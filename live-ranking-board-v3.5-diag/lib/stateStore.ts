import * as https from 'node:https';

function stripWrappingQuotes(v:string){
  const s=v.trim();
  if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'"))) return s.slice(1,-1).trim();
  return s;
}
function cleanBase(raw?:string){
  const s=stripWrappingQuotes(raw||'');
  if(!s)return '';
  try{
    const u=new URL(s);
    return `${u.protocol}//${u.host}`;
  }catch{
    return s.replace(/\/(rest|realtime)\/v1.*$/i,'').replace(/\/+$/,'');
  }
}
function cleanKey(raw?:string){return stripWrappingQuotes(raw||'').replace(/\s+/g,'').trim()}
function cfg(){return {base:cleanBase(process.env.NEXT_PUBLIC_SUPABASE_URL),key:cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY)}}

type HttpResult={status:number,text:string};
function httpsCall(urlString:string,method:'GET'|'POST',key:string,body?:string):Promise<HttpResult>{
  return new Promise((resolve,reject)=>{
    let u:URL;
    try{u=new URL(urlString)}catch(e){reject(e);return}
    const req=https.request({
      protocol:u.protocol,
      hostname:u.hostname,
      port:u.port||443,
      path:`${u.pathname}${u.search}`,
      method,
      headers:{
        apikey:key,
        Authorization:`Bearer ${key}`,
        Accept:'application/json',
        'Content-Type':'application/json',
        ...(method==='POST'?{Prefer:'resolution=merge-duplicates,return=minimal'}:{}),
        ...(body?{'Content-Length':Buffer.byteLength(body)}:{})
      },
      agent:false,
      timeout:10000
    },res=>{
      const chunks:Buffer[]=[];
      res.on('data',d=>chunks.push(Buffer.isBuffer(d)?d:Buffer.from(d)));
      res.on('end',()=>resolve({status:res.statusCode||500,text:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('timeout',()=>req.destroy(new Error('request timeout')));
    req.on('error',reject);
    if(body)req.write(body);
    req.end();
  });
}
async function withRetry(fn:()=>Promise<HttpResult>){
  let lastErr:any;
  for(let i=0;i<3;i++){
    try{return await fn()}catch(e){lastErr=e;if(i<2)await new Promise(r=>setTimeout(r,250*(i+1)))}
  }
  throw lastErr;
}

export async function readBoard(board:string){
  const {base,key}=cfg();
  if(!base||!key)return {ok:false,status:503,error:'Supabase server env missing'} as const;
  const url=`${base}/rest/v1/ranking_boards?board=eq.${encodeURIComponent(board)}&select=settings&limit=1`;
  try{
    const r=await withRetry(()=>httpsCall(url,'GET',key));
    if(r.status<200||r.status>=300)return {ok:false,status:r.status,error:`Supabase GET ${r.status}: ${r.text.slice(0,500)}`} as const;
    const rows=r.text?JSON.parse(r.text):[];
    return {ok:true,settings:rows?.[0]?.settings??null} as const;
  }catch(e:any){return {ok:false,status:502,error:`Supabase GET network: ${e?.code||''} ${e?.message||String(e)}`.trim()} as const}
}
export async function writeBoard(board:string,settings:any){
  const {base,key}=cfg();
  if(!base||!key)return {ok:false,status:503,error:'Supabase server env missing'} as const;
  const url=`${base}/rest/v1/ranking_boards?on_conflict=board`;
  const payload=JSON.stringify({board,settings,updated_at:new Date().toISOString()});
  try{
    const r=await withRetry(()=>httpsCall(url,'POST',key,payload));
    if(r.status<200||r.status>=300)return {ok:false,status:r.status,error:`Supabase POST ${r.status}: ${r.text.slice(0,700)}`} as const;
    return {ok:true} as const;
  }catch(e:any){return {ok:false,status:502,error:`Supabase POST network: ${e?.code||''} ${e?.message||String(e)}`.trim()} as const}
}
