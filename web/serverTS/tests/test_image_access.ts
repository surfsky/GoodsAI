import axios from 'axios';
import { db } from '../src/database';

async function testImage() {
    // Get first image path
    const products = await db.getAllProducts(1);
    if (products.length === 0 || products[0].images.length === 0) {
        console.log("No images in DB to test.");
        return;
    }

    const imagePath = products[0].images[0].image_path;
    console.log("Testing image path from DB:", imagePath);
    
    const url = `http://localhost:3000/${imagePath}`;
    console.log("Trying URL:", url);

    try {
        const res = await axios.head(url);
        console.log("Status:", res.status);
        console.log("Content-Type:", res.headers['content-type']);
    } catch (e: any) {
        console.error("Error accessing image:", e.response?.status, e.response?.statusText);
        if (e.response?.status === 404) {
            console.log("Image not found. Check static file serving configuration.");
        }
    }
}

testImage();
