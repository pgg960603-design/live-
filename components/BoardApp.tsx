'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Copy,ExternalLink,LockKeyhole,RefreshCw,Radio,Save,ShieldCheck,Wifi,WifiOff} from 'lucide-react';
import {BOARDS,BoardKey} from '@/lib/boards';
import {BoardSettings,defaultSettings,RankRow} from '@/lib/types';

const channelName=(board:BoardKey)=>`live-ranking:${board}`;
const storageKey=(board:BoardKey)=>`live-ranking-v2:${board}`;

export default function BoardApp({board}:{board:BoardKey}){
 const meta=BOARDS[board];
 const [settings,setSettings]=useState<BoardSettings>(defaultSettings);
 const [unlocked,setUnlocked]=useState(false);
 const [adminKey,setAdminKey]=useState('');
 const [connected,setConnected]=useState(false);
 const [loading,setLoading]=useState(false);
 const [syncWarning,setSyncWarning]=useState('');
 const [origin,setOrigin]=useState('');
 const saveTimer=useRef<any>(null);
 const lastSaved=useRef('');

 useEffect(()=>{setOrigin(window.location.origin);
  const raw=localStorage.getItem(storageKey(board));
  if(raw){try{setSettings({...defaultSettings,...JSON.parse(raw)})}catch{}}
  let mounted=true;
  const pull=()=>fetch(`/api/state?board=${board}`,{cache:'no-store'}).then(r=>r.json()).then(j=>{
    if(!mounted)return;
    if(j?.settings)setSettings(v=>{
      const remote={...defaultSettings,...j.settings};
      return remote.updatedAt>=(v.updatedAt||0)?remote:v;
    });
    setSyncWarning(j?.warning||'');
  }).catch(()=>setSyncWarning('동기화 서버 확인 필요'));
  pull();const poll=setInterval(pull,500);
  return()=>{mounted=false;clearInterval(poll)};
 },[board]);

 useEffect(()=>{localStorage.setItem(storageKey(board),JSON.stringify(settings))},[board,settings]);
 const push=(next:BoardSettings)=>{
  setSettings(next);
  if(!unlocked||!adminKey)return;
  clearTimeout(saveTimer.current);
  saveTimer.current=setTimeout(async()=>{
   const payload=JSON.stringify({board,settings:next,key:adminKey});
   if(payload===lastSaved.current)return;
   try{const r=await fetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:payload});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error||`HTTP ${r.status}`);lastSaved.current=payload;setSyncWarning('')}catch(e:any){setSyncWarning(`저장 실패: ${e?.message||'서버 오류'}`)}
  },350);
 };
 const patch=(part:Partial<BoardSettings>)=>push({...settings,...part,updatedAt:Date.now()});
 const obsUrl=`${origin}/${board}/obs`;
 const copyObs=async()=>{if(obsUrl)await navigator.clipboard.writeText(obsUrl)};
 const fetchRows=async()=>{
  if(!settings.sourceUrl)return;
  setLoading(true);
  try{
   const r=await fetch(`/api/data?url=${encodeURIComponent(settings.sourceUrl)}`,{cache:'no-store'});const j=await r.json();
   if(!j.ok)throw new Error(j.error);
   const oldByName=new Map(settings.rows.map(r=>[r.name.toLowerCase(),r]));
   const rows:RankRow[]=j.rows.map((x:any,i:number)=>{const old=oldByName.get(String(x.name).toLowerCase());return {id:old?.id||crypto.randomUUID(),name:x.name,score:x.score,penalty:old?.penalty||'',rankColor:old?.rankColor||'#ffffff',contentColor:old?.contentColor||'#ffffff',fixedRank:old?.fixedRank??null}});
   const same=JSON.stringify(rows.map(r=>[r.name,r.score]))===JSON.stringify(settings.rows.map(r=>[r.name,r.score]));
   if(!same)patch({rows});setConnected(true);
  }catch{setConnected(false)}finally{setLoading(false)}
 };
 const fetchBattle=async()=>{
  if(!settings.battleUrl)return;
  try{const r=await fetch(`/api/data?url=${encodeURIComponent(settings.battleUrl)}`,{cache:'no-store'});const j=await r.json();if(j.ok){const nextRows=j.rows.map((x:any,i:number)=>({id:`battle-${i}-${x.name}`,name:x.name,score:x.score,team:x.team}));const same=JSON.stringify(nextRows.map((r:any)=>[r.name,r.score,r.team]))===JSON.stringify(settings.battleRows.map((r:any)=>[r.name,r.score,r.team]));if(!same)patch({battleRows:nextRows});}}catch{}
 };
 useEffect(()=>{if(!settings.sourceUrl)return;fetchRows();const id=setInterval(fetchRows,3000);return()=>clearInterval(id)},[settings.sourceUrl]);
 useEffect(()=>{if(!settings.battleUrl)return;fetchBattle();const id=setInterval(fetchBattle,3000);return()=>clearInterval(id)},[settings.battleUrl]);

 const ordered=useMemo(()=>{
  const rows=[...settings.rows];
  const fixed=rows.filter(r=>r.fixedRank).sort((a,b)=>(a.fixedRank||999)-(b.fixedRank||999));
  const flex=rows.filter(r=>!r.fixedRank).sort((a,b)=>b.score-a.score);
  const slots=new Array(rows.length).fill(null);fixed.forEach(r=>{const idx=Math.max(0,Math.min(rows.length-1,(r.fixedRank||1)-1));if(!slots[idx])slots[idx]=r});
  let k=0;return slots.map(v=>v||flex[k++]).filter(Boolean) as RankRow[];
 },[settings.rows]);
 const updateRow=(id:string,p:Partial<RankRow>)=>patch({rows:settings.rows.map(r=>r.id===id?{...r,...p}:r)});
 const unlock=async()=>{
  try{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({key:adminKey})});setUnlocked(r.ok)}catch{setUnlocked(false)}
 };
 const topScore=ordered.length?Math.max(...ordered.map(r=>r.score)):0;
 const lastUpdated=settings.updatedAt?new Date(settings.updatedAt).toLocaleTimeString('ko-KR'):'-';
 const medal=(i:number)=>i===0?'g':i===1?'s':i===2?'b':'';

 return <div className="dash" style={{'--accent':meta.accent,'--accent2':meta.accent2} as any}>
  <aside className="side">
   <div className="brand"><span className="brand-dot"/>LIVE SCORE</div>
   <nav className="side-nav">
    {Object.values(BOARDS).map(b=>
     <a key={b.key} href={`/${b.key}`} className={b.key===board?'active':''} style={{'--dot':b.accent} as any}>
      <span className="dot"/>{b.label}
     </a>
    )}
   </nav>
   <a className="side-obs" href={`/${board}/obs`} target="_blank"><ExternalLink size={14}/> 송출 화면 열기</a>
  </aside>

  <main className="content">
   <header className="content-head">
    <div>
     <div className="eyebrow"><Radio size={12}/> LIVE SCORE CONTROL</div>
     <h1>{meta.label}</h1>
    </div>
    <div className="head-right">
     <div className={`status ${connected?'on':''}`}>{connected?<Wifi size={14}/>:<WifiOff size={14}/>} {connected?'자동엑셀 연결됨':'자동엑셀 미연결'}</div>
     <div className="lock-inline">
      <input type="password" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="관리키" onKeyDown={e=>e.key==='Enter'&&unlock()}/>
      <button onClick={unlock}><LockKeyhole size={14}/>{unlocked?'해제됨':'잠금 해제'}</button>
     </div>
    </div>
   </header>

   <section className="stat-row">
    <div className="stat"><span>등록 인원</span><b>{ordered.length}<em>명</em></b></div>
    <div className="stat"><span>최고 기여도</span><b>{topScore.toLocaleString('ko-KR')}</b></div>
    <div className="stat"><span>마지막 갱신</span><b className="mono">{lastUpdated}</b></div>
    <div className="stat"><span>편집 권한</span><b className={unlocked?'ok':'no'}>{unlocked?'있음':'없음'}</b></div>
   </section>

   <section className="grid2">
    <div className="panel">
     <div className="panel-title"><ExternalLink size={16}/> 자동엑셀 연결</div>
     <div className="inline">
      <input disabled={!unlocked} value={settings.sourceUrl} onChange={e=>patch({sourceUrl:e.target.value})} placeholder="자동엑셀/API 주소를 붙여넣으세요"/>
      <button disabled={!unlocked||loading} onClick={fetchRows}><RefreshCw size={14} className={loading?'spin':''}/>연결</button>
     </div>
     <small>{unlocked?'수정 가능 상태입니다.':'관리키를 입력해야 수정할 수 있습니다.'}</small>
     {settings._debug?.ranking&&<div className="debug-box">
      <b>자동 수집 진단 · {new Date(settings._debug.lastRun).toLocaleTimeString('ko-KR')}</b>
      {settings._debug.ranking.pageError
       ?<p>⚠ 페이지 접속 실패: {settings._debug.ranking.pageError}</p>
       :<p>페이지 접속 정상 · table 태그 {settings._debug.ranking.tableTags}개 · 표 줄 {settings._debug.ranking.rawRows}개 발견 · 이름/점수로 인식된 줄 {settings._debug.ranking.recognized}개</p>}
      {!settings._debug.ranking.pageError&&settings._debug.ranking.tableTags===0&&<p className="hint">표(table) 자체가 없는 페이지예요. 이 경우 이름/점수를 자동 인식하기 어려워서, 사이트 구조를 캡처해서 보내주시면 인식 규칙을 맞춰드릴 수 있어요.</p>}
      {!settings._debug.ranking.pageError&&settings._debug.ranking.tableTags>0&&settings._debug.ranking.recognized===0&&<p className="hint">표는 찾았는데 이름/점수 형식이 예상과 달라서 못 걸러냈어요. 사이트 캡처를 보내주시면 규칙을 맞춰드릴게요.</p>}
     </div>}
    </div>
    <div className="panel">
     <div className="panel-title"><Radio size={16}/> 배틀점수 · 팀전 연결</div>
     <div className="inline"><input disabled={!unlocked} value={settings.battleUrl} onChange={e=>patch({battleUrl:e.target.value})} placeholder="배틀점수 URL을 붙여넣으세요"/><button disabled={!unlocked} onClick={fetchBattle}><RefreshCw size={14}/>연결</button></div>
     <div className="team-config"><input disabled={!unlocked} value={settings.teamAName} onChange={e=>patch({teamAName:e.target.value})}/><input disabled={!unlocked} type="color" value={settings.teamAColor} onChange={e=>patch({teamAColor:e.target.value})}/><b>VS</b><input disabled={!unlocked} value={settings.teamBName} onChange={e=>patch({teamBName:e.target.value})}/><input disabled={!unlocked} type="color" value={settings.teamBColor} onChange={e=>patch({teamBColor:e.target.value})}/></div>
     <div className="battle-options"><label>팀 A 인원수 <input disabled={!unlocked} type="number" min="0" value={settings.teamASize||0} onChange={e=>patch({teamASize:Math.max(0,Number(e.target.value)||0)})}/></label><span>0 = 자동 반반 분리 · URL에 팀 정보가 있으면 자동 우선</span></div>
     <small>배틀점수 URL의 실제 데이터를 읽어 팀전용 OBS 디자인으로 다시 그립니다. 단순 iframe이 아니라 이름/점수 데이터를 추출합니다.</small>
    </div>
   </section>
   <section className="panel obs-address">
    <div className="panel-head"><div><div className="panel-title"><ExternalLink size={16}/> OBS 브라우저 소스 주소</div><p>OBS → 소스 추가 → 브라우저 → 아래 주소 붙여넣기. 배경은 투명입니다.</p></div></div>
    <div className="obs-url-row"><code>{obsUrl||`/${board}/obs`}</code><button onClick={copyObs}><Copy size={14}/> 주소 복사</button><a href={`/${board}/obs`} target="_blank">새 창 확인</a></div>
    {syncWarning&&<div className="warning-box">⚠ {syncWarning}<br/>Vercel의 NEXT_PUBLIC_SUPABASE_URL에는 <b>https://프로젝트ID.supabase.co</b>까지만 넣으세요. <b>/rest/v1</b> 또는 <b>/realtime/v1</b>은 넣으면 안 됩니다.</div>}
   </section>
   <section className="grid2">
    <div className="panel">
     <div className="panel-title"><ShieldCheck size={16}/> 송출 디자인 프리셋</div>
     <div className="themes">{(['glass','neon','blackgold'] as const).map(t=><button disabled={!unlocked} key={t} onClick={()=>patch({theme:t})} className={settings.theme===t?'selected':''}><b>{t==='glass'?'클린 글래스':t==='neon'?'네온 포인트':'블랙 골드'}</b><span>{t==='glass'?'깔끔한 반투명 랭킹':t==='neon'?'방송용 강한 포인트':'고급스러운 대회 스타일'}</span></button>)}</div>
    </div>
    <div className="panel">
     <div className="panel-title"><ExternalLink size={16}/> OBS 표시 구성</div>
     <div className="themes mode-buttons">{(['ranking','battle','combined'] as const).map(m=><button disabled={!unlocked} key={m} onClick={()=>patch({obsMode:m})} className={settings.obsMode===m?'selected':''}><b>{m==='ranking'?'랭킹만':m==='battle'?'배틀만':'랭킹 + 팀전'}</b><span>{m==='combined'?'추천 · 한 화면 통합':'OBS 전용 보기'}</span></button>)}</div>
     <small>송출 주소는 그대로 두고 여기서 구성을 즉시 변경할 수 있습니다.</small>
    </div>
   </section>

   <section className="panel">
    <div className="panel-head"><div><div className="panel-title">송출 화면 설정</div><p>OBS 화면에 즉시 반영됩니다.</p></div><div className="savehint"><Save size={13}/> 자동 저장</div></div>
    <div className="control-grid">
     <Range label="배경 어둡기" v={settings.background} min={0} max={100} suffix="%" disabled={!unlocked} onChange={v=>patch({background:v})}/>
     <Range label="양옆 그라데이션" v={settings.edgeFade} min={0} max={100} suffix="%" disabled={!unlocked} onChange={v=>patch({edgeFade:v})}/>
     <Range label="송출 글자 크기" v={settings.fontScale} min={70} max={150} suffix="%" disabled={!unlocked} onChange={v=>patch({fontScale:v})}/>
     <Range label="위아래 줄 간격" v={settings.rowGap} min={4} max={44} suffix="px" disabled={!unlocked} onChange={v=>patch({rowGap:v})}/>
     <Range label="상벌칙 ↔ 이름 간격" v={settings.labelWidth} min={55} max={150} suffix="%" disabled={!unlocked} onChange={v=>patch({labelWidth:v})}/>
    </div>
   </section>

   <section className="panel table-panel">
    <div className="panel-head"><div><div className="panel-title">현재 순위 <em>{ordered.length}명</em></div><p>동명이인은 이름 기준 중복 제거. 고정 순위가 있으면 해당 자리를 우선합니다.</p></div></div>
    <div className="rank-table">
     <div className="rank-head"><span></span><span>상·벌칙</span><span>이름</span><span>기여도</span><span>순위 고정</span><span>순위 색상</span><span>내용 색상</span></div>
     {ordered.length?ordered.map((r,i)=>
      <div className="rank-row" key={r.id}>
       <div className={`medal ${medal(i)}`}>{i+1}</div>
       <input disabled={!unlocked} value={r.penalty} onChange={e=>updateRow(r.id,{penalty:e.target.value})} placeholder="내용 입력"/>
       <strong>{r.name}</strong>
       <span className="score">{r.score.toLocaleString('ko-KR')}</span>
       <select disabled={!unlocked} value={r.fixedRank||''} onChange={e=>updateRow(r.id,{fixedRank:e.target.value?Number(e.target.value):null})}><option value="">자동</option>{ordered.map((_,n)=><option key={n} value={n+1}>{n+1}위</option>)}</select>
       <input disabled={!unlocked} type="color" value={r.rankColor} onChange={e=>updateRow(r.id,{rankColor:e.target.value})}/>
       <input disabled={!unlocked} type="color" value={r.contentColor} onChange={e=>updateRow(r.id,{contentColor:e.target.value})}/>
      </div>
     ):<div className="empty">자동엑셀 주소를 연결하면 멤버와 기여도가 표시됩니다.</div>}
    </div>
   </section>
  </main>
 </div>
}
function Range({label,v,min,max,suffix,disabled,onChange}:{label:string;v:number;min:number;max:number;suffix:string;disabled:boolean;onChange:(v:number)=>void}){return <label className="range"><span>{label}<b>{v}{suffix}</b></span><input disabled={disabled} type="range" min={min} max={max} value={v} onChange={e=>onChange(Number(e.target.value))}/></label>}
