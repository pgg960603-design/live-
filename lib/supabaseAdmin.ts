import {createClient} from '@supabase/supabase-js';
function normalizeSupabaseUrl(raw?:string){
  if(!raw) return '';
  try{const u=new URL(raw.trim());return `${u.protocol}//${u.host}`}
  catch{return raw.trim().replace(/\/(rest|realtime)\/v1.*$/i,'').replace(/\/+$/,'')}
}
export function supabaseAdmin(){
  const u=normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const k=(process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  return u&&k?createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
