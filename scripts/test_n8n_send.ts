import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.N8N_API_KEY || 'salesai_n8n_secret_key_2024';
const BASE_URL = 'http://localhost:3001/api';

async function testN8nSend() {
    console.log('--- Testing N8N Send Integration ---');
    console.log(`URL: ${BASE_URL}/whatsapp/send`);
    console.log(`API KEY: ${API_KEY}`);

    try {
        const response = await fetch(`${BASE_URL}/whatsapp/send`, {
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // Dummy ID
                to: '1234567890',
                message: 'Test message from N8N verification script.'
            })
        });

        const data: any = await response.json();

        if (response.ok) {
            console.log('SUCCESS: Request reached the backend logic.');
            console.log('Response Status:', response.status);
            console.log('Response Data:', data);
        } else {
            console.log('Backend responded with error:');
            console.log('Status:', response.status);
            console.log('Data:', data);
            
            if (response.status === 401) {
                console.error('FAILED: API Key authentication failed.');
            } else if (response.status === 500 && data.error && data.error.includes('no socket')) {
                 console.log('PARTIAL SUCCESS: Auth passed, but no active WhatsApp session found (Expected in test).');
            } else {
                console.log('Request failed as expected.');
            }
        }
    } catch (error: any) {
        console.error('ERROR: Could not connect to backend. Is it running on port 3001?');
        console.error(error.message);
    }
}

testN8nSend();
