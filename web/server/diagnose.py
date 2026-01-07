import sqlite3
import requests
import sys

def check_db():
    print("Checking Database...")
    try:
        conn = sqlite3.connect('goods.db')
        cursor = conn.cursor()
        
        # Check users
        cursor.execute("SELECT count(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"✅ Users count: {user_count}")
        
        # Check products
        cursor.execute("SELECT count(*) FROM products")
        prod_count = cursor.fetchone()[0]
        print(f"✅ Products count: {prod_count}")
        
        # Check images
        cursor.execute("SELECT count(*) FROM product_images")
        img_count = cursor.fetchone()[0]
        print(f"✅ Images count: {img_count}")
        
        # Check logs
        cursor.execute("SELECT action, details, created_at FROM logs ORDER BY created_at DESC LIMIT 5")
        logs = cursor.fetchall()
        print("\nLatest 5 Logs:")
        for log in logs:
            print(f"  [{log[2]}] {log[0]}: {log[1]}")
            
        conn.close()
    except Exception as e:
        print(f"❌ Database Error: {e}")

def check_api():
    print("\nChecking API (http://localhost:8000)...")
    try:
        # Check Root/Docs (fastapi usually has docs)
        # But we don't have a root route defined in main.py, let's try /products
        
        response = requests.get("http://localhost:8000/products", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /products: Success (Returned {len(data)} items)")
        else:
            print(f"❌ GET /products: Failed (Status {response.status_code})")
            print(response.text[:200])
            
    except requests.exceptions.ConnectionError:
        print("❌ API Connection Error: Could not connect to localhost:8000. Is the server running?")
    except Exception as e:
        print(f"❌ API Error: {e}")

if __name__ == "__main__":
    check_db()
    check_api()
