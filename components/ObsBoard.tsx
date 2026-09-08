'use client';
import {useEffect,useMemo,useState} from 'react';
import {BOARDS,BoardKey} from '@/lib/boards';
import {BattleRow,BoardSettings,defaultSettings,RankRow} from '@/lib/types';

const storageKey=(b:BoardKey)=>`live-ranking-v2:${b}`;
function order(rows:RankRow[]){return [...rows].sort((a,b)=>{if(a.fixedRank&&b.fixedRank)return a.fixedRank-b.fixedRank;if(a.fixedRank)return -1;if(b.fixedRank)return 1;return b.score-a.score})}
function splitBattle(rows:BattleRow[],s:BoardSettings){
 const explicitA=rows.filter(r=>String(r.team||'').toLowerCase()==='a'||String(r.team||'').toLowerCase()===s.teamAName.toLowerCase());
 const explicitB=rows.filter(r=>String(r.team||'').toLowerCase()==='b'||String(r.team||'').toLowerCase()===s.teamBName.toLowerCase());
 if(explicitA.length&&explicitB.length)return [explicitA,explicitB] as const;
 const cut=s.teamASize>0?Math.min(s.teamASize,rows.length):Math.ceil(rows.length/2);
 return [rows.slice(0,cut),rows.slice(cut)] as const;
}
export default function ObsBoard({board}:{board:BoardKey}){
 const meta=BOARDS[board];const [s,setS]=useState<BoardSettings>(defaultSettings);
 useEffect(()=>{
  const raw=localStorage.getItem(storageKey(board));if(raw)try{setS({...defaultSettings,...JSON.parse(raw)})}catch{}
  let alive=true;
  const pull=()=>fetch(`/api/state?board=${board}`,{cache:'no-store'}).then(r=>r.json()).then(j=>{if(alive&&j?.settings)setS({...defaultSettings,...j.settings})}).catch(()=>{});
  pull();const poll=setInterval(pull,500);
  return()=>{alive=false;clearInterval(poll)}
 },[board]);
 const rows=useMemo(()=>order(s.rows),[s.rows]);
 const [a,b]=useMemo(()=>splitBattle(s.battleRows||[],s),[s.battleRows,s.teamASize,s.teamAName,s.teamBName]);
 const totalA=a.reduce((n,x)=>n+x.score,0),totalB=b.reduce((n,x)=>n+x.score,0),grand=Math.max(1,totalA+totalB);
 const aPct=Math.round(totalA/grand*100),bPct=100-aPct,diff=Math.abs(totalA-totalB);
 const leader=totalA===totalB?'TIE':totalA>totalB?s.teamAName:s.teamBName;
 return <div className={`obs-pro theme-${s.theme} label-${board}`} style={{'--accent':meta.accent,'--accent2':meta.accent2,'--teamA':s.teamAColor,'--teamB':s.teamBColor,'--fs':s.fontScale/100} as any}>
  <div className="pro-shell">
   {(s.obsMode==='ranking'||s.obsMode==='combined')&&<section className="pro-ranking kings-card">
    <header><span className="live-dot"/><b>{meta.short}</b><span>LIVE RANKING</span><em>{rows.length} PLAYERS</em></header>
    <div className="compact-list">{rows.map((r,i)=><div className="compact-row" key={r.id} style={{color:r.contentColor}}><b className="rno" style={{color:r.rankColor}}>{String(i+1).padStart(2,'0')}</b><span className="rtext">{r.penalty||'LIVE'}</span><strong className="rname">{r.name}</strong><strong className="rscore">{r.score.toLocaleString('ko-KR')}</strong></div>)}</div>
   </section>}
   {(s.obsMode==='battle'||s.obsMode==='combined')&&<section className="battle-card kings-battle">
    <div className="battle-topline"><span>{meta.short} BATTLE</span><em>TEAM SCORE</em></div>
    <div className="battle-hero">
      <div className="team hero-a"><span>{s.teamAName}</span><strong>{totalA.toLocaleString('ko-KR')}</strong><small>{aPct}%</small></div>
      <div className="vs-core"><i>VS</i><b>{leader==='TIE'?'TIE':`${diff.toLocaleString('ko-KR')} 차이`}</b></div>
      <div className="team hero-b"><span>{s.teamBName}</span><strong>{totalB.toLocaleString('ko-KR')}</strong><small>{bPct}%</small></div>
    </div>
    <div className="battle-meter"><span style={{width:`${aPct}%`}}/><i/><b style={{width:`${bPct}%`}}/></div>
    <div className="battle-lists premium">
      <div className="team-list team-list-a">{a.map((x,i)=><p key={x.id}><i>{i+1}</i><span>{x.name}</span><b>{x.score.toLocaleString('ko-KR')}</b></p>)}</div>
      <div className="team-list team-list-b">{b.map((x,i)=><p key={x.id}><i>{i+1}</i><span>{x.name}</span><b>{x.score.toLocaleString('ko-KR')}</b></p>)}</div>
    </div>
   </section>}
  </div>
 </div>
}
