import type {Browser} from 'puppeteer-core';
import {NextRequest,NextResponse} from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import {supabaseAdmin} from '@/lib/supabaseAdmin';

export const maxDuration=60;

const RUN_BUDGET_MS=50000;
const LOOP_MS=3000;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

// 실제 사이트 표 구조에 맞춰 조정이 필요할 수 있습니다.
// (이름/기여도 열 위치가 다르면 아래 r[...] 인덱스를 바꿔주세요)
async function scrapeRows(page:any){
  const rows=await page.evaluate(()=>{
    const trs=Array.from(document.querySelectorAll('table tr'));
    return trs
      .map(tr=>Array.from(tr.querySelectorAll('td,th')).map(td=>(td as HTMLElement).innerText.trim()))
      .filter(cells=>cells.length>3);
  });
  return (rows as string[][])
    .map(r=>({name:r[r.length-2]||r[1]||'',score:parseFloat((r[r.length-1]||'0').replace(/,/g,''))||0}))
    .filter(e=>e.name&&!isNaN(e.score));
}

export async function GET(req:NextRequest){
  const auth=req.headers.get('authorization');
  if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`){
    return NextResponse.json({error:'unauthorized'},{status:401});
  }

  const dbOrNull=supabaseAdmin();
  if(!dbOrNull) return NextResponse.json({ok:false,error:'Supabase server env missing'},{status:503});
  const db=dbOrNull;

  const {data:boards}=await db.from('ranking_boards').select('board,settings');
  const targets=(boards||[]).filter((b:any)=>b.settings?.sourceUrl);
  if(!targets.length) return NextResponse.json({ok:true,note:'sourceUrl이 설정된 보드가 없습니다'});

  let browser:Browser|undefined;
  try{
    browser=await puppeteer.launch({
      args:chromium.args,
      defaultViewport:{width:1280,height:900},
      executablePath:await chromium.executablePath(),
      headless:chromium.headless
    });

    const pages=await Promise.all(targets.map(async(b:any)=>{
      const page=await browser!.newPage();
      try{ await page.goto(b.settings.sourceUrl,{waitUntil:'networkidle2',timeout:25000}); }catch{}
      return {board:b.board as string,page};
    }));

    const startedAt=Date.now();
    let cycles=0;
    while(Date.now()-startedAt<RUN_BUDGET_MS){
      await Promise.all(pages.map(async({board,page})=>{
        try{
          const rows=await scrapeRows(page);
          if(!rows.length) return;
          const {data:current}=await db.from('ranking_boards').select('settings').eq('board',board).maybeSingle();
          const oldRows:any[]=current?.settings?.rows||[];
          const byName=new Map(oldRows.map(r=>[String(r.name).toLowerCase(),r]));
          const merged=rows.map(r=>{
            const old=byName.get(r.name.toLowerCase());
            return {id:old?.id||r.name,name:r.name,score:r.score,penalty:old?.penalty||'',rankColor:old?.rankColor||'#ffffff',contentColor:old?.contentColor||'#ffffff',fixedRank:old?.fixedRank??null};
          });
          const nextSettings={...(current?.settings||{}),rows:merged,updatedAt:Date.now()};
          await db.from('ranking_boards').update({settings:nextSettings,updated_at:new Date().toISOString()}).eq('board',board);
        }catch{}
      }));
      cycles++;
      await sleep(LOOP_MS);
    }
    return NextResponse.json({ok:true,boards:targets.map((t:any)=>t.board),cycles});
  }catch(err){
    return NextResponse.json({ok:false,error:String(err)},{status:500});
  }finally{
    if(browser) await browser.close();
  }
}
