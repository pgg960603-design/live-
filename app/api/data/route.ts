import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
function normalize(input:any){
 const list=Array.isArray(input)?input:Array.isArray(input?.data)?input.data:Array.isArray(input?.rows)?input.rows:[];
 const seen=new Set<string>();
 return list.map((r:any,i:number)=>({name:String(r.name??r.이름??r.streamer??r['스트리머']??'').trim(),score:Number(String(r.score??r.기여도??r.contribution??r['합산 기여도']??0).replace(/,/g,''))||0,index:i})).filter((r:any)=>r.name&&(!seen.has(r.name.toLowerCase())&&seen.add(r.name.toLowerCase()))).sort((a:any,b:any)=>b.score-a.score).map((r:any,i:number)=>({...r,rank:i+1}));
}
export async function GET(req:NextRequest){
 const src=req.nextUrl.searchParams.get('url');
 if(!src)return NextResponse.json({ok:false,error:'url required'},{status:400});
 try{
  const u=new URL(src); if(!['http:','https:'].includes(u.protocol))throw new Error('invalid protocol');
  const res=await fetch(u.toString(),{cache:'no-store',headers:{'user-agent':'LiveRankingBoard/2.0'}});
  if(!res.ok)throw new Error(`source ${res.status}`);
  const text=await res.text(); let payload:any;
  try{payload=JSON.parse(text)}catch{payload=parseText(text)}
  return NextResponse.json({ok:true,rows:normalize(payload),fetchedAt:Date.now()},{headers:{'Cache-Control':'no-store'}});
 }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'fetch failed'},{status:502})}
}
function parseText(text:string){
 const clean=text.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ');
 const lines=clean.split(/\n+/).map(s=>s.trim()).filter(Boolean); const out:any[]=[];
 for(let i=0;i<lines.length-1;i++){const n=Number(lines[i+1].replace(/,/g,''));if(lines[i].length<40&&Number.isFinite(n)&&n>0)out.push({name:lines[i],score:n})}
 return out;
}
