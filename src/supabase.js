import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fqqbglkqmhbajmolxhei.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzZnZtYWx3dXh2Z2VmYnJ0cGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzc0MDUsImV4cCI6MjA5NjYxMzQwNX0.q-9B5plCCx4OtiAbpYQJ95MARpAaJXTm5uIxfXxq9aY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)