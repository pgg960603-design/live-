import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';

type AnyRow={name:string;score:number;team?:string;index:number};
const num=(v:any)=>Number(String(v??'').replace(/[^0-9.\-]/g,''))||0;
function normalize(input:any){
 const list=Array.isArray(input)?input:Array.isArray(input?.data)?input.data:Array.isArray(input?.rows)?input.rows:Array.isArray(input?.ranking)?input.ranking:[];
 const seen=new Set<string>();
 return list.map((r:any,i:number)=>({
   name:String(r.name??r.이름??r.streamer??r['스트리머']??r.nickname??r.user??'').trim(),
   score:num(r.score??r.점수??r.기여도??r.contribution??r['합산 기여도']??r.total??0),
   team:String(r.team??r.팀??r.side??'').trim()||undefined,index:i
 })).filter((r:AnyRow)=>r.name&&(!seen.has(`${r.team||''}:${r.name}`.toLowerCase())&&seen.add(`${r.team||''}:${r.name}`.toLowerCase())))
   .map((r:AnyRow,i:number)=>({...r,rank:i+1}));
}
function isLikelyName(value:string){
 const s=String(value||'').replace(/\s+/g,' ').trim();
 if(!s||s.length<2||s.length>24)return false;
 if(/^[-+*/=<>()[\]{}.,:;!?%#@~_|\\]+$/.test(s))return false;
 if(/^\d/.test(s)||/https?:\/\//i.test(s))return false;
 if(/[.!?。！？]$/.test(s))return false;
 if(/(연중무휴|않습니다|진행합니다|불가합니다|금지합니다|최소|최대|추가\d*|스트리머|기여도|순위|점수|후원|배틀|팀전|내용 입력|자동|공지|안내|현재 순위|동명이인)/i.test(s))return false;
 // 닉네임은 한글/영문/숫자/일부 닉네임 기호만 허용한다. 긴 문장/설명문은 제외.
 return /^[가-힣A-Za-z0-9_.·ㆍ-]+(?:\s[가-힣A-Za-z0-9_.·ㆍ-]+)?$/.test(s);
}
function parseScoreCell(v:string){
 const s=String(v||'').replace(/,/g,'').trim();
 // 셀 전체가 숫자(소수/음수 포함)일 때만 점수로 인정. 문장 속 숫자는 무시.
 if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
function parseText(text:string){
 const clean=text.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/tr>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<\/div>/gi,'\n')
  .replace(/<\/td>/gi,'\t').replace(/<\/th>/gi,'\t')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&');
 const lines=clean.split(/\n+/).map(s=>s.replace(/[ ]+/g,' ').trim()).filter(Boolean);
 const out:any[]=[];
 for(const line of lines){
   const parts=line.split(/\t|\|/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
   if(parts.length<2)continue;
   // 한 행에서 이름 셀과 숫자 셀을 찾는다. 페이지 전체의 인접 텍스트는 서로 묶지 않는다.
   const scoreIndexes=parts.map((v,i)=>({i,n:parseScoreCell(v)})).filter(x=>x.n!==null);
   if(!scoreIndexes.length)continue;
   const sc=scoreIndexes[scoreIndexes.length-1];
   const name=parts.slice(0,sc.i).reverse().find(isLikelyName);
   if(name)out.push({name,score:sc.n});
 }
 return out;
}
export async function GET(req:NextRequest){
 const src=req.nextUrl.searchParams.get('url');
 if(!src)return NextResponse.json({ok:false,error:'url required'},{status:400});
 try{
  const u=new URL(src);if(!['http:','https:'].includes(u.protocol))throw new Error('invalid protocol');
  const res=await fetch(u.toString(),{cache:'no-store',headers:{'user-agent':'Mozilla/5.0 LiveRankingBoard/3.1','accept':'text/html,application/json,*/*'}});
  if(!res.ok)throw new Error(`source ${res.status}`);
  const text=await res.text();let payload:any;try{payload=JSON.parse(text)}catch{payload=parseText(text)}
  const rows=normalize(payload);
  return NextResponse.json({ok:true,rows,fetchedAt:Date.now(),note:rows.length?'':'자바스크립트 렌더링 페이지면 Cron 브라우저 수집으로 자동 반영됩니다.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'fetch failed'},{status:502})}
}
