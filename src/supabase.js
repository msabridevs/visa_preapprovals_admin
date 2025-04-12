import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rbsrverouylthjdbrxgd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJic3J2ZXJvdXlsdGhqZGJyeGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNDQ1MTQsImV4cCI6MjA1OTcyMDUxNH0.KckvPMHcEWVHfKVNBRjLZENIsMi3uTXAsmvRXdrH74o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
