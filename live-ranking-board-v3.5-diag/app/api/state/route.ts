import {NextRequest,NextResponse} from 'next/server';
import {readBoard,writeBoard} from '@/lib/stateStore';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const preferredRegion='icn1';
const noStore={'Cache-Control':'no-store, no-cache, must-revalidate'};
export async function GET(req:NextRequest){
 const board=req.nextUrl.searchParams.get('board');
 if(!board)return NextResponse.json({ok:false,error:'board required'},{status:400,headers:noStore});
 const out=await readBoard(board);
 if(!out.ok){console.error('[state GET]',board,out.error);return NextResponse.json({ok:false,settings:null,sync:false,error:out.error},{status:out.status,headers:noStore});}
 return NextResponse.json({ok:true,settings:out.settings,sync:true},{headers:noStore});
}
export async function PUT(req:NextRequest){
 try{
  const body=await req.json();
  if(body.key!==(process.env.ADMIN_KEY||'change-me'))return NextResponse.json({ok:false,error:'관리키가 올바르지 않습니다.'},{status:401,headers:noStore});
  if(!body.board||!body.settings)return NextResponse.json({ok:false,error:'board/settings required'},{status:400,headers:noStore});
  const out=await writeBoard(body.board,body.settings);
  if(!out.ok){console.error('[state PUT]',body.board,out.error);return NextResponse.json({ok:false,error:out.error},{status:out.status,headers:noStore});}
  return NextResponse.json({ok:true},{headers:noStore});
 }catch(e:any){console.error('[state PUT parse]',e);return NextResponse.json({ok:false,error:e?.message||'invalid request'},{status:400,headers:noStore});}
}
