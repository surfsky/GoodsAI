import { FeatureExtractor } from '../src/model';
import { db } from '../src/database';
import path from 'path';
import { CONFIG } from '../src/config';

async function refresh() {
    console.log("Starting feature refresh...");
    const extractor = FeatureExtractor.getInstance();
    await extractor.init();

    // Get all products with images
    // We can iterate over product_images table directly.
    // But DBManager doesn't expose it directly easily.
    // Let's use `db.getAllProducts` which returns everything.
    
    // Actually, we can just query the DB directly if we could, but let's use the public API.
    // Or add a method to DB.
    // Let's just use `db.getAllProducts` with a huge limit.
    
    const products = await db.getAllProducts(10000, 0);
    console.log(`Found ${products.length} products.`);
    
    let updated = 0;
    let errors = 0;

    for (const p of products) {
        for (const img of p.images) {
            // Correctly resolve path: DB path is relative "uploads/..."
            const absPath = path.resolve(CONFIG.UPLOAD_DIR, '..', img.image_path);
            // console.log(`Processing ${absPath}...`);
            
            try {
                const vector = await extractor.extract(absPath);
                if (vector) {
                    // Update DB
                    // We need a method to update vector. 
                    // `addProductImage` inserts a new one.
                    // We need `updateImageVector`.
                    // Or we can just run raw SQL if we expose db.
                    // Since `db` is private, we can't.
                    // But we can add a method to `DBManager`.
                    // Wait, `db` object in `database.ts` is exported instance.
                    // But `run` is private.
                    // I should have added `updateFeatureVector`.
                    // I will add it to `database.ts` via SearchReplace.
                    
                    // For now, let's assume I will add it.
                    await (db as any).updateFeatureVector(img.id, vector);
                    updated++;
                } else {
                    console.error(`Failed to extract feature for ${img.image_path}`);
                    errors++;
                }
            } catch (e) {
                console.error(`Error processing ${img.image_path}:`, e);
                errors++;
            }
        }
    }
    
    console.log(`Refresh complete. Updated: ${updated}, Errors: ${errors}`);
}

refresh();
