import { createClient } from '@supabase/supabase-js';

//retrieves url and key from .env
const supabaseUrl = process.env.SUPABASE_URL; 
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
