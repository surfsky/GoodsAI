import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import AdmZip from 'adm-zip';
import { CONFIG } from './config';
import { db } from './database';
import { FeatureExtractor } from './model';
import { generateToken, authenticateToken, requireAdmin } from './auth';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));

// Multer setup (Memory storage to process with Sharp)
const upload = multer({ storage: multer.memoryStorage() });

// --- Helpers ---

async function processAndSaveImage(buffer: Buffer, originalName: string, customPath?: string): Promise<string> {
    const filename = customPath ? path.basename(customPath) : `${Date.now()}_${path.parse(originalName).name}.jpg`;
    const filepath = customPath ? customPath : path.join(CONFIG.UPLOAD_DIR, filename);
    
    // Ensure dir exists if custom path
    if (customPath) {
        const dir = path.dirname(customPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    let pipeline = image.toFormat('jpeg', { quality: 85, mozjpeg: true });
    
    if (metadata.width && metadata.width > 800) {
        pipeline = pipeline.resize({ width: 800 });
    }

    await pipeline.toFile(filepath);
    
    // Return relative path for DB
    if (customPath) {
        return path.relative(path.resolve(CONFIG.UPLOAD_DIR, '..'), filepath);
    }
    return `uploads/${filename}`;
}

// --- Auth Routes ---

app.post('/token', upload.none(), async (req, res) => {
    // console.log("Token request body:", req.body);
    // console.log("Token request headers:", req.headers);
    
    // Ensure req.body is present
    if (!req.body) {
         return res.status(400).json({ detail: "Request body is missing" });
    }

    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ detail: "Missing username or password" });
    }

    const user = await db.getUser(username);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ detail: "Incorrect username or password" });
    }

    const token = generateToken(user);
    // Log login
    await db.addLog(user.id, user.username, "LOGIN", "User logged in");
    
    res.json({ access_token: token, token_type: "bearer", role: user.role, username: user.username });
});

app.get('/users/me', authenticateToken, (req, res) => {
    res.json({ username: req.user!.sub, role: req.user!.role });
});

app.post('/users/change-password', authenticateToken, async (req, res) => {
    const { old_password, new_password } = req.body;
    const user = await db.getUser(req.user!.sub);
    
    if (!user || !(await bcrypt.compare(old_password, user.password_hash))) {
        return res.status(400).json({ detail: "Incorrect old password" });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.updatePassword(user.id, hash);
    await db.addLog(user.id, user.username, "CHANGE_PASSWORD", "User changed password");
    
    res.json({ message: "Password updated successfully" });
});

// --- User Management (Admin) ---

app.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json(users);
    } catch (e) {
        console.error("Error fetching users:", e);
        res.status(500).json({ detail: "Failed to fetch users" });
    }
});

app.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const id = await db.addUser(username, hash, role);
        if (!id) return res.status(400).json({ detail: "Username already exists" });
        
        await db.addLog(req.user!.user_id, req.user!.sub, "CREATE_USER", `Created user ${username}`);
        res.json({ id, username, role });
    } catch (e) {
        res.status(500).json({ detail: "Error creating user" });
    }
});

app.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    const uid = parseInt(req.params.id);
    if (uid === req.user!.user_id) return res.status(400).json({ detail: "不能删除自己" });
    
    await db.deleteUser(uid);
    await db.addLog(req.user!.user_id, req.user!.sub, "DELETE_USER", `Deleted user ID ${uid}`);
    res.json({ message: "User deleted" });
});

app.post('/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    const { new_password } = req.body;
    const hash = await bcrypt.hash(new_password, 10);
    const uid = parseInt(req.params.id);
    await db.updatePassword(uid, hash);
    await db.addLog(req.user!.user_id, req.user!.sub, "RESET_PASSWORD", `Reset password for user ID ${uid}`);
    res.json({ message: "Password reset successfully" });
});

// --- Logs (Admin) ---

app.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { limit, offset, search } = req.query;
        const logs = await db.getLogs(
            parseInt(limit as string) || 20,
            parseInt(offset as string) || 0,
            search as string
        );
        res.json(logs);
    } catch (e) {
        console.error("Error fetching logs:", e);
        res.status(500).json({ detail: "Failed to fetch logs" });
    }
});

app.delete('/logs', authenticateToken, requireAdmin, async (req, res) => {
    const { months } = req.query;
    await db.deleteOldLogs(parseInt(months as string) || 3);
    await db.addLog(req.user!.user_id, req.user!.sub, "DELETE_LOGS", "Deleted old logs");
    res.json({ message: "Old logs deleted" });
});

// --- Product Management ---

app.get('/products', async (req, res) => {
    const { limit, offset, search } = req.query;
    const products = await db.getAllProducts(
        parseInt(limit as string) || 20,
        parseInt(offset as string) || 0,
        search as string
    );
    res.json(products);
});

app.get('/products/:id', async (req, res) => {
    const product = await db.getProductById(parseInt(req.params.id));
    if (!product) return res.status(404).json({ detail: "Product not found" });
    res.json(product);
});

app.post('/products', authenticateToken, requireAdmin, upload.array('files'), async (req: Request, res: Response) => {
    const { model_name, product_name, price, maintenance_time } = req.body;
    const files = req.files as Express.Multer.File[];

    // Check conflict (only if not updating logic, which this is create)
    // Actually python code allows checking by model_name
    
    try {
        const pid = await db.addProduct(model_name, product_name, parseFloat(price), maintenance_time);
        
        await db.addLog(req.user!.user_id, req.user!.sub, "create_product", `Created product ${model_name} (ID: ${pid})`);

        let count = 0;
        if (files && files.length > 0) {
            const extractor = FeatureExtractor.getInstance();
            for (const file of files) {
                const relativePath = await processAndSaveImage(file.buffer, file.originalname);
                const absPath = path.join(CONFIG.UPLOAD_DIR, path.basename(relativePath));
                
                // Feature extraction
                const vector = await extractor.extract(absPath);
                if (vector) {
                    await db.addProductImage(pid, relativePath, vector);
                    count++;
                }
            }
        }

        res.json({ id: pid, status: "created", images_count: count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ detail: "Error creating product" });
    }
});

app.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { model_name, product_name, price, maintenance_time } = req.body;
    const pid = parseInt(req.params.id);
    
    // Check if model name conflict
    const existing = await db.getProductByModel(model_name);
    if (existing && existing.id !== pid) {
        return res.status(400).json({ detail: "Model name already exists" });
    }

    await db.updateProduct(pid, model_name, product_name, parseFloat(price), maintenance_time);
    await db.addLog(req.user!.user_id, req.user!.sub, "UPDATE_PRODUCT", `Updated product ID: ${pid}`);
    
    res.json({ status: "updated" });
});

app.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const pid = parseInt(req.params.id);
    const product = await db.getProductById(pid);
    if (product) {
        // Delete images from disk
        for (const img of product.images) {
             const p = path.join(CONFIG.UPLOAD_DIR, path.basename(img.image_path));
             if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        await db.deleteProduct(pid);
        await db.addLog(req.user!.user_id, req.user!.sub, "DELETE_PRODUCT", `Deleted product ID: ${pid}`);
    }
    res.json({ status: "deleted" });
});

app.post('/products/batch-delete', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
    let { ids } = req.body; // Array of numbers
    console.log("Batch delete request for IDs:", ids);
    
    if (!Array.isArray(ids)) return res.status(400).json({ detail: "Invalid IDs" });
    
    // Ensure numbers
    ids = ids.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));

    try {
        // 1. Get images to delete files
        const imagePaths = await db.getProductsImages(ids);
        console.log(`Found ${imagePaths.length} images to delete`);
        
        // 2. Delete from DB
        await db.deleteProducts(ids);
        console.log("Deleted products from DB");
        
        // 3. Delete files
        for (const imgPath of imagePaths) {
            const p = path.join(CONFIG.UPLOAD_DIR, path.basename(imgPath));
            if (fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                } catch (e) {
                    console.error(`Failed to delete file ${p}:`, e);
                }
            }
        }

        await db.addLog(req.user!.user_id, req.user!.sub, "BATCH_DELETE", `Deleted products: ${ids}`);
        res.json({ status: "deleted", count: ids.length });
    } catch (e) {
        console.error("Batch delete error:", e);
        res.status(500).json({ detail: "Batch delete failed" });
    }
});

app.post('/products/:id/upload-image', authenticateToken, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
    const pid = parseInt(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ detail: "No file uploaded" });

    try {
        const relativePath = await processAndSaveImage(file.buffer, file.originalname);
        const absPath = path.join(CONFIG.UPLOAD_DIR, path.basename(relativePath));
        
        const extractor = FeatureExtractor.getInstance();
        const vector = await extractor.extract(absPath);
        
        if (vector) {
            const newId = await db.addProductImage(pid, relativePath, vector);
            await db.addLog(req.user!.user_id, req.user!.sub, "UPLOAD_IMAGE", `Added image to product ID: ${pid}`);
            res.json({ status: "uploaded", image_path: relativePath, id: newId });
        } else {
            res.status(500).json({ detail: "Feature extraction failed" });
        }
    } catch (e) {
        res.status(500).json({ detail: "Error uploading image" });
    }
});

app.delete('/images/:id', authenticateToken, requireAdmin, async (req, res) => {
    const imgId = parseInt(req.params.id);
    const imagePath = await db.deleteImage(imgId);
    if (imagePath) {
        const p = path.join(CONFIG.UPLOAD_DIR, path.basename(imagePath));
        if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    res.json({ status: "deleted" });
});

app.post('/products/reorder-images', authenticateToken, requireAdmin, async (req, res) => {
    const { image_orders } = req.body; // List of {id, display_order}
    await db.updateImageOrders(image_orders);
    res.json({ status: "ok" });
});

app.post('/batch-update', authenticateToken, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file || !file.originalname.endsWith('.zip')) {
        return res.status(400).json({ detail: "File must be a zip" });
    }

    try {
        const zip = new AdmZip(file.buffer);
        const zipEntries = zip.getEntries();
        
        const batchDirName = `batch_${Math.floor(Date.now() / 1000)}`;
        const batchDirPath = path.join(CONFIG.UPLOAD_DIR, batchDirName);
        if (!fs.existsSync(batchDirPath)) fs.mkdirSync(batchDirPath, { recursive: true });

        const batchProducts = new Map<string, number>();
        let count = 0;
        let updatedCount = 0;
        const extractor = FeatureExtractor.getInstance();

        for (const entry of zipEntries) {
            if (entry.isDirectory || entry.entryName.startsWith('__MACOSX')) continue;
            
            const entryName = entry.entryName; // e.g., "Folder/Image.jpg"
            if (!entryName.match(/\.(jpg|jpeg|png|bmp|webp)$/i)) continue;

            // Parsing logic similar to Python
            const parts = entryName.split('/');
            let modelName = "";
            let productName = "";
            let priceVal = 0.0;
            let fileName = "";

            if (parts.length >= 2) {
                const folderName = parts[parts.length - 2];
                fileName = parts[parts.length - 1];
                
                const partsName = folderName.split('_');
                modelName = partsName[0];
                
                if (partsName.length >= 3) {
                    const possiblePrice = partsName[partsName.length - 1];
                    const price = parseFloat(possiblePrice);
                    if (!isNaN(price)) {
                        priceVal = price;
                        productName = partsName.slice(1, -1).join('_');
                    } else {
                        productName = partsName.slice(1).join('_');
                    }
                } else if (partsName.length === 2) {
                    const possibleSecond = partsName[1];
                    const price = parseFloat(possibleSecond);
                    if (!isNaN(price)) {
                        priceVal = price;
                    } else {
                        productName = possibleSecond;
                    }
                }
            } else {
                fileName = parts[parts.length - 1];
                modelName = path.parse(fileName).name;
            }

            modelName = modelName.trim();
            productName = productName.trim();

            // Save image
            const saveName = `${modelName}_${fileName}`.replace(/[^a-zA-Z0-9._-]/g, '');
            const savePath = path.join(batchDirPath, saveName);
            
            const buffer = entry.getData();
            // Reuse processAndSaveImage with custom path support
            await processAndSaveImage(buffer, fileName, savePath);
            const dbPath = `uploads/${batchDirName}/${saveName}`; // Relative path

            // Get or Create Product
            let pid = batchProducts.get(modelName);
            
            if (!pid) {
                const existing = await db.getProductByModel(modelName);
                if (existing) {
                    pid = existing.id;
                    // Update if needed
                    const newName = productName || existing.product_name;
                    const newPrice = priceVal > 0 ? priceVal : existing.price;
                    if (newName !== existing.product_name || newPrice !== existing.price) {
                        await db.updateProduct(pid!, modelName, newName, newPrice, existing.maintenance_time);
                    }
                } else {
                    pid = await db.addProduct(modelName, productName, priceVal, new Date().toISOString().split('T')[0]);
                    count++;
                }
                batchProducts.set(modelName, pid!);
            }

            // Extract features
            const vector = await extractor.extract(savePath);
            if (vector) {
                await db.addProductImage(pid!, dbPath, vector);
                updatedCount++;
            }
        }

        await db.addLog(req.user!.user_id, req.user!.sub, "BATCH_UPDATE", `Processed ${count} new products, ${updatedCount} images`);
        res.json({ status: "success", processed_products_count: count, updated_images_count: updatedCount });

    } catch (e) {
        console.error("Batch update error:", e);
        res.status(500).json({ detail: "Batch update failed" });
    }
});

// --- Search / Recognition ---

app.post('/recognize', upload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ detail: "No file uploaded" });

    try {
        const relativePath = await processAndSaveImage(file.buffer, file.originalname);
        const absPath = path.join(CONFIG.UPLOAD_DIR, path.basename(relativePath));
        
        const extractor = FeatureExtractor.getInstance();
        const queryVector = await extractor.extract(absPath);
        
        if (!queryVector) {
            return res.status(500).json({ detail: "Feature extraction failed" });
        }

        const allVectors = await db.getAllVectors();
        const productScores = new Map<number, any>();

        for (const item of allVectors) {
            const sim = extractor.computeSimilarity(queryVector, item.vector);
            const pid = item.product_id;
            
            const current = productScores.get(pid);
            if (!current || sim > current.score) {
                productScores.set(pid, {
                    id: pid,
                    product: {
                        id: pid,
                        model_name: item.model_name,
                        product_name: item.product_name,
                        price: item.price,
                        maintenance_time: item.maintenance_time,
                        image_path: item.image_path
                    },
                    score: sim
                });
            }
        }

        const results = Array.from(productScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        // Fetch full images for top results
        for (const res of results) {
            res.product.images = await db.getProductImagesFull(res.id);
        }

        res.json(results);

    } catch (e) {
        console.error(e);
        res.status(500).json({ detail: "Recognition failed" });
    }
});

// Start server
app.listen(CONFIG.PORT, () => {
    console.log(`Server running on port ${CONFIG.PORT}`);
    FeatureExtractor.getInstance().init();
});
