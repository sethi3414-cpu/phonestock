import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fqqbglkqmhbajmolxhei.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcWJnbGtxbWhiYWptb2x4aGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNjMwNzMsImV4cCI6MjA2MzkzOTA3M30.zPuhfkf7J5BemjbZZx7nrWbbUAGriYMM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)