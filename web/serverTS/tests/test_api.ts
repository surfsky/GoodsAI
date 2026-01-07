import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000';
let TOKEN = '';

async function testLogin() {
    console.log('--- Testing Login (FormData) ---');
    try {
        const form = new FormData();
        form.append('username', 'admin');
        form.append('password', 'admin123');

        const res = await axios.post(`${API_URL}/token`, form, {
            headers: { ...form.getHeaders() }
        });
        console.log('Login successful. Token received.');
        TOKEN = res.data.access_token;
        console.log('Role:', res.data.role);
    } catch (e: any) {
        console.error('Login failed:', e.response?.data || e.message);
        process.exit(1);
    }
}

async function testUsers() {
    console.log('\n--- Testing GET /users (Admin Only) ---');
    try {
        const res = await axios.get(`${API_URL}/users`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log(`Success. Found ${res.data.length} users.`);
    } catch (e: any) {
        console.error('GET /users failed:', e.response?.data || e.message);
    }
}

async function testLogs() {
    console.log('\n--- Testing GET /logs (Admin Only) ---');
    try {
        const res = await axios.get(`${API_URL}/logs`, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log(`Success. Found ${res.data.length} logs.`);
    } catch (e: any) {
        console.error('GET /logs failed:', e.response?.data || e.message);
    }
}

async function testBatchDelete() {
    console.log('\n--- Testing POST /products/batch-delete ---');
    // First verify with invalid IDs (e.g. empty or non-existent) to see if it crashes
    try {
        const res = await axios.post(`${API_URL}/products/batch-delete`, {
            ids: [-1, -2] // Non-existent IDs
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log('Batch delete executed:', res.data);
    } catch (e: any) {
        console.error('Batch delete failed:', e.response?.data || e.message);
    }
}

async function testRecognize() {
    console.log('\n--- Testing POST /recognize ---');
    const uploadDir = path.join(__dirname, '../uploads');
    // Find a test image
    if (!fs.existsSync(uploadDir)) {
         console.log('Uploads dir not found, skipping recognize test.');
         return;
    }
    const files = fs.readdirSync(uploadDir);
    const imgFile = files.find(f => f.endsWith('.jpg') || f.endsWith('.png'));
    
    if (!imgFile) {
        console.log('No image found for recognition test.');
        return;
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(path.join(uploadDir, imgFile)));

    try {
        const res = await axios.post(`${API_URL}/recognize`, form, {
            headers: { 
                ...form.getHeaders()
                // No auth needed for recognize usually, but let's check config. 
                // In index.ts: app.post('/recognize', upload.single('file'), ...); -> No auth middleware
            }
        });
        console.log('Recognition success. Top result:', res.data[0]);
    } catch (e: any) {
        console.error('Recognition failed:', e.response?.data || e.message);
    }
}

async function run() {
    await testLogin();
    await testUsers();
    await testLogs();
    await testBatchDelete();
    await testRecognize();
}

run();
