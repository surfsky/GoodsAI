import { FeatureExtractor } from '../src/model';
import path from 'path';

async function test() {
    const extractor = FeatureExtractor.getInstance();
    await extractor.init();
    
    // Create a dummy image path that doesn't exist, this will fail.
    // We need a real image.
    // Or we can modify extract to take a buffer or create a dummy tensor manually to test the model run.
    // But let's check if there are images in uploads.
    
    const fs = require('fs');
    const uploadDir = path.resolve(__dirname, '../../server/uploads');
    if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        const img = files.find((f: string) => f.endsWith('.jpg') || f.endsWith('.png'));
        if (img) {
            console.log("Testing with image:", img);
            const p = path.join(uploadDir, img);
            const vec = await extractor.extract(p);
            console.log("Vector length:", vec?.length);
            console.log("Vector sample:", vec?.slice(0, 10));
            
            // Check for NaNs
            let hasNaN = false;
            if (vec) {
                for (let i = 0; i < vec.length; i++) {
                    if (isNaN(vec[i])) {
                        hasNaN = true;
                        break;
                    }
                }
            }
            console.log("Has NaN:", hasNaN);
        } else {
            console.log("No images found to test.");
        }
    }
}

test();
