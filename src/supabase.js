import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fqqbglkqmhbajmolxhei.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Xq7Jp9MMkTGViY5MHu8Dxw_6mJtg6CT'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)