import { createClient } from "@supabase/supabase-js";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function keepAlive() {
  try {
    // Fetch data to prevent Supabase project from pausing
    const { data, error } = await supabase.from("user").select();
    if (error) throw new Error(error.message);
    console.log("Supabase keep-alive successful:", data);
  } catch (error) {
    console.error("Supabase keep-alive error:", error.message);
  }
}

// Run the keep-alive function
keepAlive();