import { supabaseAdmin } from '../database/supabase';

async function setPassword() {
    if (!supabaseAdmin) return;
    const userId = 'af109a24-b27b-446e-ac86-ca4cb723223e'; // ptilak5210@gmail.com
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: 'TestPassword123!'
    });
    console.log("Update result:", data.user?.id, error);
}

setPassword();
