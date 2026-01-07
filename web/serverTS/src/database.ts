import sqlite3 from 'sqlite3';
import { CONFIG } from './config';
import bcrypt from 'bcrypt';

export class DBManager {
    private db: sqlite3.Database;

    constructor() {
        this.db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
            if (err) {
                console.error('Could not connect to database', err);
            } else {
                console.log('Connected to database');
                this.db.run("PRAGMA foreign_keys = ON");
                this.initDb();
            }
        });
        this.db.configure('busyTimeout', 3000);
    }

    private run(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private runInsert(sql: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    private get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row as T);
            });
        });
    }

    private all<T>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows as T[]);
            });
        });
    }

    private async initDb() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                product_name TEXT,
                price REAL,
                maintenance_time TEXT,
                created_at TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS product_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                image_path TEXT,
                feature_vector BLOB,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                action TEXT,
                details TEXT,
                created_at TEXT
            )`
        ];

        for (const query of queries) {
            await this.run(query);
        }

        // Check for display_order column migration
        try {
            await this.run("ALTER TABLE product_images ADD COLUMN display_order INTEGER DEFAULT 0");
        } catch (e) {
            // Column likely exists
        }

        // Seed Admin
        const admin = await this.get("SELECT id FROM users WHERE username='admin'");
        if (!admin) {
            const hash = await bcrypt.hash("admin123", 10);
            await this.run("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", 
                ["admin", hash, "admin", new Date().toISOString()]);
        }
        
        // Seed User
        const user = await this.get("SELECT id FROM users WHERE username='user'");
        if (!user) {
            const hash = await bcrypt.hash("user123", 10);
            await this.run("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", 
                ["user", hash, "user", new Date().toISOString()]);
        }
    }

    // --- Users ---
    async getUser(username: string): Promise<any> {
        return this.get("SELECT * FROM users WHERE username=?", [username]);
    }
    
    async getAllUsers(): Promise<any[]> {
        return this.all("SELECT id, username, role, created_at FROM users ORDER BY id ASC");
    }

    async addUser(username: string, passwordHash: string, role = 'user'): Promise<number> {
        return this.runInsert("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
            [username, passwordHash, role, new Date().toISOString()]);
    }

    async deleteUser(userId: number): Promise<void> {
        return this.run("DELETE FROM users WHERE id=?", [userId]);
    }

    async updatePassword(userId: number, passwordHash: string): Promise<void> {
        return this.run("UPDATE users SET password_hash=? WHERE id=?", [passwordHash, userId]);
    }

    // --- Logs ---
    async addLog(userId: number | null, username: string | null, action: string, details: string): Promise<void> {
        return this.run("INSERT INTO logs (user_id, username, action, details, created_at) VALUES (?, ?, ?, ?, ?)",
            [userId, username, action, details, new Date().toISOString()]);
    }

    async getLogs(limit = 20, offset = 0, search = ""): Promise<any[]> {
        let query = "SELECT * FROM logs";
        const params: any[] = [];
        if (search) {
            query += " WHERE username LIKE ? OR action LIKE ? OR details LIKE ?";
            const term = `%${search}%`;
            params.push(term, term, term);
        }
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);
        return this.all(query, params);
    }

    async deleteOldLogs(months = 3): Promise<void> {
        const date = new Date();
        date.setMonth(date.getMonth() - months);
        await this.run("DELETE FROM logs WHERE created_at < ?", [date.toISOString()]);
    }

    // --- Products ---
    async addProduct(modelName: string, productName: string, price: number, maintenanceTime: string): Promise<number> {
        return this.runInsert(
            "INSERT INTO products (model_name, product_name, price, maintenance_time, created_at) VALUES (?, ?, ?, ?, ?)",
            [modelName, productName, price, maintenanceTime, new Date().toISOString()]
        );
    }

    async getProductByModel(modelName: string): Promise<any> {
        return this.get("SELECT * FROM products WHERE model_name=?", [modelName]);
    }

    async getProductById(pid: number): Promise<any> {
        const product = await this.get<any>("SELECT * FROM products WHERE id=?", [pid]);
        if (product) {
            product.images = await this.getProductImagesFull(pid);
        }
        return product;
    }

    async addProductImage(productId: number, imagePath: string, featureVector: Float32Array | null, displayOrder = 0): Promise<number> {
        const buffer = featureVector ? Buffer.from(featureVector.buffer) : null;
        
        if (displayOrder === 0) {
            const res = await this.get<any>("SELECT MAX(display_order) as maxOrder FROM product_images WHERE product_id=?", [productId]);
            const currentMax = res?.maxOrder ?? -1;
            displayOrder = currentMax + 1;
        }

        return this.runInsert(
            "INSERT INTO product_images (product_id, image_path, feature_vector, display_order) VALUES (?, ?, ?, ?)",
            [productId, imagePath, buffer, displayOrder]
        );
    }

    async updateProduct(pid: number, modelName: string, productName: string, price: number, maintenanceTime: string): Promise<void> {
        return this.run(
            "UPDATE products SET model_name=?, product_name=?, price=?, maintenance_time=? WHERE id=?",
            [modelName, productName, price, maintenanceTime, pid]
        );
    }

    async updateImageOrders(orders: {id: number, display_order: number}[]): Promise<void> {
        for (const item of orders) {
            await this.run("UPDATE product_images SET display_order=? WHERE id=?", [item.display_order, item.id]);
        }
    }

    async getProductImagesFull(pid: number): Promise<any[]> {
        return this.all("SELECT id, image_path, display_order FROM product_images WHERE product_id=? ORDER BY display_order ASC, id ASC", [pid]);
    }

    async deleteProduct(pid: number): Promise<void> {
        await this.run("DELETE FROM products WHERE id=?", [pid]);
        // Cascade delete should handle images, but to be safe/explicit if FK not enabled strictly:
        // But we enabled FK in python. In node sqlite3, FK support needs "PRAGMA foreign_keys = ON".
        // I added that in init. Wait, I missed it in constructor.
    }
    
    async getProductsImages(pids: number[]): Promise<string[]> {
        if (pids.length === 0) return [];
        const placeholders = pids.map(() => '?').join(',');
        const rows = await this.all<any>(`SELECT image_path FROM product_images WHERE product_id IN (${placeholders})`, pids);
        return rows.map(r => r.image_path);
    }

    async deleteProducts(pids: number[]): Promise<void> {
        if (pids.length === 0) return;
        const placeholders = pids.map(() => '?').join(',');
        await this.run(`DELETE FROM products WHERE id IN (${placeholders})`, pids);
    }

    async deleteImage(imageId: number): Promise<string | null> {
        const row = await this.get<any>("SELECT image_path FROM product_images WHERE id=?", [imageId]);
        if (row) {
            await this.run("DELETE FROM product_images WHERE id=?", [imageId]);
            return row.image_path;
        }
        return null;
    }

    async getAllProducts(limit = 20, offset = 0, search = ""): Promise<any[]> {
        let query = "SELECT * FROM products";
        const params: any[] = [];
        if (search) {
            query += " WHERE model_name LIKE ? OR product_name LIKE ?";
            const term = `%${search}%`;
            params.push(term, term);
        }
        query += " ORDER BY id DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const products = await this.all<any>(query, params);
        if (products.length === 0) return [];

        const pids = products.map(p => p.id);
        const placeholders = pids.map(() => '?').join(',');
        
        const images = await this.all<any>(
            `SELECT product_id, id, image_path, display_order FROM product_images WHERE product_id IN (${placeholders}) ORDER BY display_order ASC, id ASC`,
            pids
        );

        const productsMap = new Map(products.map(p => [p.id, { ...p, images: [] }]));
        for (const img of images) {
            productsMap.get(img.product_id).images.push({
                id: img.id,
                image_path: img.image_path,
                display_order: img.display_order
            });
        }

        return Array.from(productsMap.values());
    }

    async updateFeatureVector(imageId: number, vector: Float32Array): Promise<void> {
        const buffer = Buffer.from(vector.buffer);
        return this.run("UPDATE product_images SET feature_vector=? WHERE id=?", [buffer, imageId]);
    }

    async getAllVectors(): Promise<any[]> {
        const rows = await this.all<any>(`
            SELECT p.id, p.model_name, p.product_name, p.price, p.maintenance_time,
                   pi.image_path, pi.feature_vector
            FROM products p
            JOIN product_images pi ON p.id = pi.product_id
            WHERE pi.feature_vector IS NOT NULL
        `);

        return rows.map(r => {
            const buffer = r.feature_vector; 
            // Safer way to convert Buffer/Blob to Float32Array
            // Create a copy of the buffer to ensure it's not a slice with non-zero offset
            // and has correct alignment
            const arrayBuffer = new Uint8Array(buffer).buffer;
            const floatArray = new Float32Array(arrayBuffer);
            
            return {
                product_id: r.id,
                model_name: r.model_name,
                product_name: r.product_name,
                price: r.price,
                maintenance_time: r.maintenance_time,
                image_path: r.image_path,
                vector: floatArray
            };
        });
    }
}

export const db = new DBManager();
