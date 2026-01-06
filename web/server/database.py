import sqlite3
import numpy as np
import os
from datetime import datetime, timedelta
import bcrypt
import threading

# Get absolute path to the directory where this file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "goods.db")

# ------------------------------------------------------
# Database Manager
# ------------------------------------------------------
class DBManager:
    def __init__(self):
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        # Enable foreign keys for every connection
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.init_db()

    def init_db(self):
        """Initialize database tables"""
        cursor = self.conn.cursor()
        
        # Product Table (Basic Info)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                product_name TEXT,
                price REAL,
                maintenance_time TEXT,
                created_at TEXT
            )
        ''')
        
        # Images Table (One-to-Many)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS product_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                image_path TEXT,
                feature_vector BLOB,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        ''')
        
        # Users Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT
            )
        ''')
        
        # Logs Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                action TEXT,
                details TEXT,
                created_at TEXT
            )
        ''')
        
        # Migration: check if product_images has display_order
        cursor.execute("PRAGMA table_info(product_images)")
        columns = [info[1] for info in cursor.fetchall()]
        if "display_order" not in columns:
            print("Migrating DB: Adding display_order column...")
            try:
                cursor.execute("ALTER TABLE product_images ADD COLUMN display_order INTEGER DEFAULT 0")
                self.conn.commit()
            except Exception as e:
                print(f"Migration failed: {e}")

        # Seed Admin User
        cursor.execute("SELECT id FROM users WHERE username='admin'")
        if not cursor.fetchone():
            print("Seeding admin user...")
            hashed = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            created_at = datetime.now().isoformat()
            cursor.execute("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", 
                           ("admin", hashed, "admin", created_at))
            self.conn.commit()
            
        # Seed Normal User
        cursor.execute("SELECT id FROM users WHERE username='user'")
        if not cursor.fetchone():
            print("Seeding normal user...")
            hashed = bcrypt.hashpw("user123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            created_at = datetime.now().isoformat()
            cursor.execute("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)", 
                           ("user", hashed, "user", created_at))
            self.conn.commit()

        self.conn.commit()

    # --- User Management ---
    def get_user(self, username):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, username, password_hash, role FROM users WHERE username=?", (username,))
        row = cursor.fetchone()
        if row:
            return {"id": row[0], "username": row[1], "password_hash": row[2], "role": row[3]}
        return None

    def get_all_users(self):
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, username, role, created_at FROM users ORDER BY id ASC")
        rows = cursor.fetchall()
        return [{"id": r[0], "username": r[1], "role": r[2], "created_at": r[3]} for r in rows]

    def add_user(self, username, password_hash, role='user'):
        created_at = datetime.now().isoformat()
        cursor = self.conn.cursor()
        try:
            cursor.execute("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
                           (username, password_hash, role, created_at))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None

    def delete_user(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM users WHERE id=?", (user_id,))
        self.conn.commit()

    def update_password(self, user_id, password_hash):
        cursor = self.conn.cursor()
        cursor.execute("UPDATE users SET password_hash=? WHERE id=?", (password_hash, user_id))
        self.conn.commit()

    # --- Log Management ---
    def add_log(self, user_id, username, action, details):
        cursor = self.conn.cursor()
        created_at = datetime.now().isoformat()
        cursor.execute("INSERT INTO logs (user_id, username, action, details, created_at) VALUES (?, ?, ?, ?, ?)",
                       (user_id, username, action, details, created_at))
        self.conn.commit()

    def get_logs(self, limit=20, offset=0, search=None):
        cursor = self.conn.cursor()
        query = "SELECT id, user_id, username, action, details, created_at FROM logs"
        params = []
        
        if search:
            query += " WHERE username LIKE ? OR action LIKE ? OR details LIKE ?"
            term = f"%{search}%"
            params.extend([term, term, term])
            
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [{"id": r[0], "user_id": r[1], "username": r[2], "action": r[3], "details": r[4], "created_at": r[5]} for r in rows]

    def delete_old_logs(self, months=3):
        # Calculate date threshold
        threshold = (datetime.now() - timedelta(days=30*months)).isoformat()
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM logs WHERE created_at < ?", (threshold,))
        deleted_count = cursor.rowcount
        self.conn.commit()
        return deleted_count

    # --- Product Management ---


    def add_product(self, model_name, product_name, price, maintenance_time):
        """Add a new product (without images first)"""
        created_at = datetime.now().isoformat()
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO products (model_name, product_name, price, maintenance_time, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (model_name, product_name, price, maintenance_time, created_at))
        self.conn.commit()
        return cursor.lastrowid

    def get_product_by_model(self, model_name):
        """Find product by model name"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT id, model_name, product_name, price, maintenance_time FROM products WHERE model_name=?', (model_name,))
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "model_name": row[1],
                "product_name": row[2],
                "price": row[3],
                "maintenance_time": row[4]
            }
        return None

    def get_product_by_id(self, pid):
        """Find product by ID"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT id, model_name, product_name, price, maintenance_time, created_at FROM products WHERE id=?', (pid,))
        row = cursor.fetchone()
        if row:
            # Get images
            images = self.get_product_images_full(pid)
            return {
                "id": row[0],
                "model_name": row[1],
                "product_name": row[2],
                "price": row[3],
                "maintenance_time": row[4],
                "created_at": row[5],
                "images": images
            }
        return None

    def add_product_image(self, product_id, image_path, feature_vector, display_order=0):
        """Add an image to a product"""
        blob = feature_vector.tobytes() if feature_vector is not None else None
        cursor = self.conn.cursor()
        
        # Get max order to append at end if order not specified (or logic in app)
        if display_order == 0:
            cursor.execute('SELECT MAX(display_order) FROM product_images WHERE product_id=?', (product_id,))
            res = cursor.fetchone()
            current_max = res[0] if res and res[0] is not None else -1
            display_order = current_max + 1

        cursor.execute('''
            INSERT INTO product_images (product_id, image_path, feature_vector, display_order)
            VALUES (?, ?, ?, ?)
        ''', (product_id, image_path, blob, display_order))
        self.conn.commit()
        return cursor.lastrowid

    def update_product(self, pid, model_name, product_name, price, maintenance_time):
        """Update product info"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE products 
            SET model_name=?, product_name=?, price=?, maintenance_time=?
            WHERE id=?
        ''', (model_name, product_name, price, maintenance_time, pid))
        self.conn.commit()

    def update_image_orders(self, image_orders: list):
        """Update display order for multiple images. 
           image_orders: list of {'id': image_id, 'display_order': order}
        """
        cursor = self.conn.cursor()
        try:
            for item in image_orders:
                cursor.execute('UPDATE product_images SET display_order=? WHERE id=?', 
                                  (item['display_order'], item['id']))
            self.conn.commit()
        except Exception as e:
            print(f"Error updating orders: {e}")
            self.conn.rollback()

    def get_product_images(self, pid):
        """Get image paths for a product"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT image_path FROM product_images WHERE product_id=? ORDER BY display_order ASC, id ASC', (pid,))
        return [r[0] for r in cursor.fetchall()]

    def get_product_images_full(self, pid):
        """Get full image info for a product"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT id, image_path, display_order FROM product_images WHERE product_id=? ORDER BY display_order ASC, id ASC', (pid,))
        return [{"id": r[0], "image_path": r[1], "display_order": r[2]} for r in cursor.fetchall()]

    def get_products_images(self, pids: list):
        """Get image paths for multiple products"""
        if not pids:
            return []
        cursor = self.conn.cursor()
        placeholders = ','.join(['?'] * len(pids))
        cursor.execute(f'SELECT image_path FROM product_images WHERE product_id IN ({placeholders})', pids)
        return [r[0] for r in cursor.fetchall()]

    def delete_product(self, pid):
        """Delete a product and its images"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM products WHERE id=?', (pid,))
        self.conn.commit()

    def delete_products(self, pids: list):
        """Batch delete products"""
        if not pids:
            return
        cursor = self.conn.cursor()
        placeholders = ','.join(['?'] * len(pids))
        cursor.execute(f'DELETE FROM products WHERE id IN ({placeholders})', pids)
        self.conn.commit()

    def delete_image(self, image_id):
        """Delete specific image"""
        cursor = self.conn.cursor()
        # First get path to return for file deletion
        cursor.execute('SELECT image_path FROM product_images WHERE id=?', (image_id,))
        row = cursor.fetchone()
        if row:
            cursor.execute('DELETE FROM product_images WHERE id=?', (image_id,))
            self.conn.commit()
            return row[0]
        return None

    def get_all_products(self, limit=20, offset=0, search=None):
        """Get products with their images, supporting pagination and search"""
        try:
            with self.lock:
                cursor = self.conn.cursor()
                
                # Base query for products
                query = "SELECT id, model_name, product_name, price, maintenance_time, created_at FROM products"
                params = []
                
                # Add search condition
                if search:
                    query += " WHERE model_name LIKE ? OR product_name LIKE ?"
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term])
                
                # Add pagination
                query += " ORDER BY id DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                product_rows = cursor.fetchall()
                
                if not product_rows:
                    return []
                
                products_map = {}
                pids = []
                for r in product_rows:
                    pid = r[0]
                    pids.append(pid)
                    products_map[pid] = {
                        "id": pid,
                        "model_name": r[1],
                        "product_name": r[2] or "",
                        "price": r[3],
                        "maintenance_time": r[4],
                        "created_at": r[5],
                        "images": []
                    }
                
                # Fetch images for these products
                placeholders = ','.join(['?'] * len(pids))
                img_query = f'''
                    SELECT product_id, id, image_path, display_order 
                    FROM product_images 
                    WHERE product_id IN ({placeholders})
                    ORDER BY display_order ASC, id ASC
                '''
                cursor.execute(img_query, pids)
                img_rows = cursor.fetchall()
                
                for r in img_rows:
                    pid = r[0]
                    if pid in products_map:
                        products_map[pid]["images"].append({
                            "id": r[1],
                            "image_path": r[2],
                            "display_order": r[3]
                        })
            
            return list(products_map.values())
        except Exception as e:
            print(f"Error getting products: {e}")
            return []

    def get_all_vectors(self):
        """Get all vectors for search"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT p.id, p.model_name, p.product_name, p.price, p.maintenance_time,
                   pi.image_path, pi.feature_vector
            FROM products p
            JOIN product_images pi ON p.id = pi.product_id
            WHERE pi.feature_vector IS NOT NULL
        ''')
        rows = cursor.fetchall()
        
        vectors = []
        for r in rows:
            vec = np.frombuffer(r[6], dtype=np.float32)
            vectors.append({
                "product_id": r[0],
                "model_name": r[1],
                "product_name": r[2] or "",
                "price": r[3],
                "maintenance_time": r[4],
                "image_path": r[5],
                "vector": vec
            })
        return vectors
