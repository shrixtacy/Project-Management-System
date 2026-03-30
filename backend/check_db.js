import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: authUsers, error: err1 } = await supabase.auth.admin.listUsers();
  const { data: publicUsers, error: err2 } = await supabase.from('users').select('*');
  
  console.log("Auth Users:");
  authUsers?.users.forEach(u => console.log(u.email, u.user_metadata));
  
  console.log("\nPublic Users:");
  console.log(publicUsers);
}

check();
