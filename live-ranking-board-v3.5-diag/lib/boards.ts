export type BoardKey='sparta'|'universe'|'death-male'|'death-female';
export const BOARDS={
 sparta:{key:'sparta',label:'스파르타',short:'SPARTA',accent:'#f6c344',accent2:'#ff8a00'},
 universe:{key:'universe',label:'유니버스',short:'UNIVERSE',accent:'#ff66c4',accent2:'#8b5cf6'},
 'death-male':{key:'death-male',label:'데스레이블 남자',short:'DEATH M',accent:'#a855f7',accent2:'#4f46e5'},
 'death-female':{key:'death-female',label:'데스레이블 여자',short:'DEATH F',accent:'#d946ef',accent2:'#7c3aed'}
} as const;
export function boardOrDefault(v:string):BoardKey{return v in BOARDS?v as BoardKey:'sparta'}
