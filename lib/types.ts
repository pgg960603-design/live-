export type RankRow={id:string;name:string;score:number;penalty:string;rankColor:string;contentColor:string;fixedRank?:number|null};
export type BattleRow={id:string;name:string;score:number;team?:'A'|'B'|string};
export type ScrapeDebug={pageError:string|null;tableTags:number;rawRows:number;recognized:number;bodyLen:number}|null;
export type BoardSettings={
 sourceUrl:string;battleUrl:string;theme:'glass'|'neon'|'blackgold';obsMode:'ranking'|'battle'|'combined';
 background:number;edgeFade:number;fontScale:number;rowGap:number;labelWidth:number;rows:RankRow[];battleRows:BattleRow[];
 teamAName:string;teamBName:string;teamAColor:string;teamBColor:string;teamASize:number;updatedAt:number;
 _debug?:{lastRun:number;ranking:ScrapeDebug;battle:ScrapeDebug}
};
export const defaultSettings:BoardSettings={sourceUrl:'',battleUrl:'',theme:'neon',obsMode:'combined',background:12,edgeFade:80,fontScale:100,rowGap:10,labelWidth:100,rows:[],battleRows:[],teamAName:'TEAM A',teamBName:'TEAM B',teamAColor:'#ff5a68',teamBColor:'#5aa7ff',teamASize:0,updatedAt:0};
