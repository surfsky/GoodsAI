import { db } from '../src/database';

async function checkPaths() {
    console.log("Checking image paths in DB...");
    const products = await db.getAllProducts(5);
    for (const p of products) {
        console.log(`Product ${p.id} (${p.model_name}):`);
        for (const img of p.images) {
            console.log(`  - Image ID ${img.id}: ${img.image_path}`);
        }
    }
}

checkPaths();
