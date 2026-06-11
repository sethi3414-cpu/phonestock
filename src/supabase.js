import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fqqbglkqmhbajmolxhei.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_BqfNPuu_Fno9VRbmC33uOw_Vwtw6KA-'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)