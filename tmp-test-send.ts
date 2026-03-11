import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const token = process.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch('http://localhost:3001/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                to: '+146200720343263',
                message: 'hello'
            })
        });
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", data);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
test();
