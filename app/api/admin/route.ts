import {NextRequest,NextResponse} from 'next/server';
export async function POST(req:NextRequest){
 const {key}=await req.json();
 const expected=process.env.ADMIN_KEY||'change-me';
 return key===expected?NextResponse.json({ok:true}):NextResponse.json({ok:false},{status:401});
}
