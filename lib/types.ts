export type RankRow={id:string;name:string;score:number;penalty:string;rankColor:string;contentColor:string;fixedRank?:number|null};
export type BoardSettings={sourceUrl:string;theme:'glass'|'neon'|'blackgold';background:number;edgeFade:number;fontScale:number;rowGap:number;labelWidth:number;rows:RankRow[];updatedAt:number};
export const defaultSettings:BoardSettings={sourceUrl:'',theme:'glass',background:0,edgeFade:70,fontScale:100,rowGap:22,labelWidth:100,rows:[],updatedAt:0};
