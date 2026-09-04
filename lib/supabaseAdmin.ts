import {createClient} from '@supabase/supabase-js';

export function supabaseAdmin(){
  const u=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return u&&k?createClient(u,k,{auth:{persistSession:false}}):null;
}
