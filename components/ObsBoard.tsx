'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {BOARDS,BoardKey} from '@/lib/boards';
import {BoardSettings,defaultSettings,RankRow} from '@/lib/types';
import {supabase} from '@/lib/supabase';

const storageKey=(b:BoardKey)=>`live-ranking-v2:${b}`;

function order(rows:RankRow[]){
  const fixed=rows.filter(r=>r.fixedRank).sort((a,b)=>(a.fixedRank||999)-(b.fixedRank||999));
  const flex=rows.filter(r=>!r.fixedRank).sort((a,b)=>b.score-a.score);
  const slots=new Array(rows.length).fill(null) as (RankRow|null)[];
  fixed.forEach(r=>{let i=Math.max(0,Math.min(rows.length-1,(r.fixedRank||1)-1));while(slots[i]&&i<slots.length-1)i++;slots[i]=r});
  let k=0;return slots.map(x=>x||flex[k++]).filter(Boolean) as RankRow[];
}

function groupCount(n:number){
  if(n<=10) return 1;
  if(n<=20) return 3;
  if(n<=30) return 4;
  return 5;
}

function splitGroups(rows:RankRow[]){
  const g=groupCount(rows.length);
  const per=Math.ceil(rows.length/g)||1;
  const out:RankRow[][]=[];
  for(let i=0;i<g;i++){
    const slice=rows.slice(i*per,(i+1)*per);
    if(slice.length) out.push(slice);
  }
  return out;
}

// 순위가 바뀔 때 부드럽게 슬라이드되도록 하는 FLIP 애니메이션 훅 (약 30fps 체감 목표)
function useFlip(rows:RankRow[]){
  const refs=useRef(new Map<string,HTMLDivElement>());
  const prevRects=useRef(new Map<string,DOMRect>());

  useLayoutEffect(()=>{
    const nextRects=new Map<string,DOMRect>();
    refs.current.forEach((el,id)=>{ if(el) nextRects.set(id,el.getBoundingClientRect()); });

    refs.current.forEach((el,id)=>{
      if(!el) return;
      const prev=prevRects.current.get(id);
      const next=nextRects.get(id);
      if(!prev||!next) return;
      const dx=prev.left-next.left;
      const dy=prev.top-next.top;
      if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5) return;
      el.style.transition='none';
      el.style.transform=`translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(()=>{
        el.style.transition='transform 420ms cubic-bezier(.2,.8,.2,1)';
        el.style.transform='translate(0,0)';
      });
    });

    prevRects.current=nextRects;
  },[rows]);

  return (id:string)=>(el:HTMLDivElement|null)=>{
    if(el) refs.current.set(id,el); else refs.current.delete(id);
  };
}

export default function ObsBoard({board}:{board:BoardKey}){
  const meta=BOARDS[board];
  const [s,setS]=useState<BoardSettings>(defaultSettings);

  useEffect(()=>{
    const raw=localStorage.getItem(storageKey(board));
    if(raw){try{setS({...defaultSettings,...JSON.parse(raw)})}catch{}}
    const onStorage=(e:StorageEvent)=>{ if(e.key===storageKey(board)&&e.newValue) try{setS({...defaultSettings,...JSON.parse(e.newValue)})}catch{} };
    window.addEventListener('storage',onStorage);
    if(!supabase) return ()=>window.removeEventListener('storage',onStorage);
    const sb=supabase;
    sb.from('ranking_boards').select('settings').eq('board',board).maybeSingle().then(({data})=>data?.settings&&setS({...defaultSettings,...data.settings}));
    const ch=sb.channel(`obs:${board}`).on('postgres_changes',{event:'*',schema:'public',table:'ranking_boards',filter:`board=eq.${board}`},p=>{
      const n=(p.new as any)?.settings; if(n) setS({...defaultSettings,...n});
    }).subscribe();
    return ()=>{ window.removeEventListener('storage',onStorage); sb.removeChannel(ch); };
  },[board]);

  useEffect(()=>{
    if(!s.sourceUrl) return;
    const tick=async()=>{
      try{
        const r=await fetch(`/api/data?url=${encodeURIComponent(s.sourceUrl)}`,{cache:'no-store'});
        const j=await r.json();
        if(j.ok){
          const old=new Map(s.rows.map(x=>[x.name.toLowerCase(),x]));
          setS(v=>({...v,rows:j.rows.map((x:any)=>{
            const o=old.get(String(x.name).toLowerCase());
            return {id:o?.id||x.name,name:x.name,score:x.score,penalty:o?.penalty||'',rankColor:o?.rankColor||'#fff',contentColor:o?.contentColor||'#fff',fixedRank:o?.fixedRank??null};
          })}));
        }
      }catch{}
    };
    tick();
    const id=setInterval(tick,3000);
    return ()=>clearInterval(id);
  },[s.sourceUrl]);

  const rows=useMemo(()=>order(s.rows),[s.rows]);
  const groups=useMemo(()=>splitGroups(rows),[rows]);
  const setRef=useFlip(rows);

  return (
    <div className={`obs theme-${s.theme}`} style={{'--accent':meta.accent,'--accent2':meta.accent2,'--shade':s.background/100,'--fade':`${s.edgeFade}%`,'--fs':s.fontScale/100,'--gap':`${s.rowGap}px`,'--label':s.labelWidth/100} as any}>
      <div className="obs-vignette"/>
      <div className={`obs-columns cols-${groups.length}`}>
        {groups.map((g,gi)=>(
          <div className="obs-col" key={gi}>
            {g.map(r=>{
              const i=rows.findIndex(x=>x.id===r.id);
              return (
                <div className="obs-row" key={r.id} ref={setRef(r.id)}>
                  <div className="place" style={{color:r.rankColor}}>{String(i+1).padStart(2,'0')}</div>
                  <div className="penalty" style={{color:r.contentColor}}>{r.penalty||'—'}</div>
                  <div className="name" style={{color:r.contentColor}}>{r.name}</div>
                  <div className="obs-score" style={{color:r.contentColor}}>{r.score.toLocaleString('ko-KR')}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
