import 'dotenv/config'; // loads .env file

import { createClient } from '@supabase/supabase-js'; // lets us talk to Supabase

const supabaseUrl = process.env.SUPABASE_URL; // our Supabase project URL
const supabaseKey = process.env.SUPABASE_KEY; // our Supabase anon key

const supabase = createClient(supabaseUrl, supabaseKey); // sets up the connection

export default supabase; // now we can use it in other files
