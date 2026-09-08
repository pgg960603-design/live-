import type {Browser} from 'puppeteer-core';
import {NextRequest,NextResponse} from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
export const maxDuration=60;
const RUN_BUDGET_MS=50000,LOOP_MS=3000,sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const scoreCell=(v:string)=>{const s=String(v||'').replace(/,/g,'').trim();if(!/^-?\d+(?:\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null};
const likelyName=(v:string)=>{const s=String(v||'').replace(/\s+/g,' ').trim();if(!s||s.length<2||s.length>24||/^\d/.test(s)||/[.!?。！？]$/.test(s))return false;if(/(연중무휴|않습니다|진행합니다|불가합니다|금지합니다|최소|최대|추가\d*|스트리머|기여도|순위|점수|후원|배틀|팀전|내용 입력|자동|공지|안내|현재 순위|동명이인)/i.test(s))return false;return /^[가-힣A-Za-z0-9_.·ㆍ-]+(?:\s[가-힣A-Za-z0-9_.·ㆍ-]+)?$/.test(s)};

// 진단용: 원본 표 개수 / 인식된 행 개수를 함께 반환해서 어디서 걸러졌는지 바로 알 수 있게 한다.
async function scrapeRows(page:any){
 const raw=await page.evaluate(()=>{
  const tables=Array.from(document.querySelectorAll('table tr')).map(tr=>Array.from(tr.querySelectorAll('td,th')).map(td=>(td as HTMLElement).innerText.trim())).filter(r=>r.length>=2);
  const bodyLen=(document.body?.innerText||'').length;
  return {tables,bodyLen,tableTagCount:document.querySelectorAll('table').length};
 });
 const out:{name:string;score:number;team?:string}[]=[];
 for(const r of raw.tables as string[][]){
  const nums=r.map((v,i)=>({i,n:scoreCell(v)})).filter(x=>x.n!==null);
  if(!nums.length)continue;
  const sc=nums[nums.length-1];
  const name=r.slice(0,sc.i).reverse().find(likelyName)||'';
  if(name)out.push({name,score:sc.n as number});
 }
 return {rows:out,rawTableRows:raw.tables.length,tableTagCount:raw.tableTagCount,bodyLen:raw.bodyLen};
}

async function openPage(browser:Browser,url:string){
 const page=await browser.newPage();
 let error:string|null=null;
 try{await page.goto(url,{waitUntil:'networkidle2',timeout:25000})}
 catch(e:any){error=e?.message||String(e)}
 return {page,error};
}

export async function GET(req:NextRequest){
 const auth=req.headers.get('authorization');if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'unauthorized'},{status:401});
 const db=supabaseAdmin();if(!db)return NextResponse.json({ok:false,error:'Supabase server env missing'},{status:503});
 const {data:boards,error}=await db.from('ranking_boards').select('board,settings');if(error)return NextResponse.json({ok:false,error:error.message},{status:503});
 const targets=(boards||[]).filter((b:any)=>b.settings?.sourceUrl||b.settings?.battleUrl);if(!targets.length)return NextResponse.json({ok:true,note:'연결 URL이 설정된 보드가 없습니다'});
 let browser:Browser|undefined;
 try{
  browser=await puppeteer.launch({args:chromium.args,defaultViewport:{width:1440,height:1000},executablePath:await chromium.executablePath(),headless:chromium.headless});
  const pages=await Promise.all(targets.map(async(b:any)=>{
   const ranking=b.settings.sourceUrl?await openPage(browser!,b.settings.sourceUrl):null;
   const battle=b.settings.battleUrl?await openPage(browser!,b.settings.battleUrl):null;
   return {board:b.board,ranking,battle};
  }));
  const started=Date.now();let cycles=0;
  while(Date.now()-started<RUN_BUDGET_MS){
   await Promise.all(pages.map(async t=>{
    try{
     const [{data:current},rankResult,battleResult]=await Promise.all([
      db.from('ranking_boards').select('settings').eq('board',t.board).maybeSingle(),
      t.ranking&&!t.ranking.error?scrapeRows(t.ranking.page):Promise.resolve(null),
      t.battle&&!t.battle.error?scrapeRows(t.battle.page):Promise.resolve(null)
     ]);
     const settings=current?.settings||{};const next:any={...settings};
     const rankRows=rankResult?.rows||[];
     const battleRows=battleResult?.rows||[];
     if(rankRows.length){const old=settings.rows||[],byName=new Map(old.map((r:any)=>[String(r.name).toLowerCase(),r]));next.rows=rankRows.map((r:any)=>{const o:any=byName.get(r.name.toLowerCase());return{id:o?.id||r.name,name:r.name,score:r.score,penalty:o?.penalty||'',rankColor:o?.rankColor||'#ffffff',contentColor:o?.contentColor||'#ffffff',fixedRank:o?.fixedRank??null}})}
     if(battleRows.length)next.battleRows=battleRows.map((r:any,i:number)=>({id:`battle-${i}-${r.name}`,name:r.name,score:r.score,team:r.team}));
     // 값이 하나도 안 잡혀도 "왜 안 잡혔는지"는 항상 기록해서 관리자 화면에서 바로 볼 수 있게 한다.
     next._debug={
      lastRun:Date.now(),
      ranking:t.ranking?{pageError:t.ranking.error,tableTags:rankResult?.tableTagCount??0,rawRows:rankResult?.rawTableRows??0,recognized:rankRows.length,bodyLen:rankResult?.bodyLen??0}:null,
      battle:t.battle?{pageError:t.battle.error,tableTags:battleResult?.tableTagCount??0,rawRows:battleResult?.rawTableRows??0,recognized:battleRows.length,bodyLen:battleResult?.bodyLen??0}:null
     };
     // 값이 안 잡혀도 진단 정보는 항상 최신으로 반영되어야 하므로 매번 갱신 시각을 올린다.
     next.updatedAt=Date.now();
     await db.from('ranking_boards').update({settings:next,updated_at:new Date().toISOString()}).eq('board',t.board);
    }catch(e){/* 이번 사이클은 건너뛰고 다음 사이클에서 재시도 */}
   }));
   cycles++;await sleep(LOOP_MS);
  }
  return NextResponse.json({ok:true,boards:targets.map((t:any)=>t.board),cycles});
 }catch(e:any){return NextResponse.json({ok:false,error:String(e)},{status:500})}
 finally{if(browser)await browser.close()}
}
