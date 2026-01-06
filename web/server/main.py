from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List, Dict
import shutil
import os
import zipfile
import io
import aiofiles
from datetime import datetime, timedelta
from PIL import Image
from jose import JWTError, jwt
import bcrypt

from model import FeatureExtractor
from database import DBManager

app = FastAPI(title="GoodsAI API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
print(f"UPLOADS_DIR: {UPLOADS_DIR}")

db = DBManager()
# Lazy load model only when needed or at startup
ai_model = FeatureExtractor()

# Mount static files
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ------------------------------------------------------
# Security Configuration
# ------------------------------------------------------
SECRET_KEY = "goodsai_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ------------------------------------------------------
# Pydantic Models
# ------------------------------------------------------
class ProductUpdate(BaseModel):
    model_name: str
    product_name: str
    price: float
    maintenance_time: str

class BatchDeleteRequest(BaseModel):
    ids: List[int]

class ReorderImagesRequest(BaseModel):
    items: List[Dict[str, int]] # [{'id': 1, 'display_order': 0}, ...]

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class User(BaseModel):
    username: str
    role: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class PasswordReset(BaseModel):
    new_password: str

# ------------------------------------------------------
# Helper Methods
# ------------------------------------------------------
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def save_upload_file(file: UploadFile, destination: str):
    try:
        with open(destination, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

def process_and_save_image(image_data: bytes, save_path: str, max_width: int = 800):
    """Resize and save image"""
    try:
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Resize if width > max_width
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
        img.save(save_path, quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"Error processing image: {e}")
        return False

def fix_zip_filename(filename):
    """Fix encoding issues with zip filenames"""
    try:
        # If it was decoded as CP437 (default for non-utf8 flagged zips), recover bytes
        bytes_name = filename.encode('cp437')
    except:
        return filename

    # Try decoding as UTF-8 first
    try:
        return bytes_name.decode('utf-8')
    except UnicodeDecodeError:
        pass
        
    # Try decoding as GBK
    try:
        return bytes_name.decode('gbk')
    except UnicodeDecodeError:
        pass
    
    # Try decoding as Big5
    try:
        return bytes_name.decode('big5')
    except UnicodeDecodeError:
        pass

    return filename

# ------------------------------------------------------
# Dependencies
# ------------------------------------------------------
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception
    
    user = db.get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return current_user

# ------------------------------------------------------
# Auth & Logs Endpoints
# ------------------------------------------------------

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}, expires_delta=access_token_expires
    )
    
    # Log login
    db.add_log(user["id"], user["username"], "LOGIN", "User logged in")
    
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"], "username": user["username"]}

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"]}

@app.post("/users/change-password")
async def change_password(
    pwd: PasswordChange, 
    current_user: dict = Depends(get_current_user)
):
    # Verify old password
    if not verify_password(pwd.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="旧密码错误")
    
    # Hash new password
    hashed = bcrypt.hashpw(pwd.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.update_password(current_user["id"], hashed)
    
    db.add_log(current_user["id"], current_user["username"], "CHANGE_PASSWORD", "User changed password")
    return {"status": "ok"}

@app.get("/users")
async def get_all_users(current_user: dict = Depends(get_current_admin)):
    return db.get_all_users()

@app.post("/users")
async def create_user(
    user: UserCreate, 
    current_user: dict = Depends(get_current_admin)
):
    if db.get_user(user.username):
        raise HTTPException(status_code=400, detail="用户名已存在")
        
    hashed = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    uid = db.add_user(user.username, hashed, user.role)
    
    if uid:
        db.add_log(current_user["id"], current_user["username"], "CREATE_USER", f"Created user {user.username}")
        return {"status": "created", "id": uid}
    else:
        raise HTTPException(status_code=500, detail="创建用户失败")

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: dict = Depends(get_current_admin)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="不能删除自己")
    
    # Check if target user is 'admin'
    cursor = db.conn.cursor()
    cursor.execute("SELECT username FROM users WHERE id=?", (user_id,))
    row = cursor.fetchone()
    if row and row[0] == 'admin':
        raise HTTPException(status_code=400, detail="不能删除系统默认管理员")
        
    db.delete_user(user_id)
    db.add_log(current_user["id"], current_user["username"], "DELETE_USER", f"Deleted user ID {user_id}")
    return {"status": "deleted"}

@app.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    pwd: PasswordReset,
    current_user: dict = Depends(get_current_admin)
):
    hashed = bcrypt.hashpw(pwd.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.update_password(user_id, hashed)
    db.add_log(current_user["id"], current_user["username"], "RESET_PASSWORD", f"Reset password for user ID {user_id}")
    return {"status": "ok"}

@app.get("/logs")
async def get_logs(
    limit: int = 20, 
    offset: int = 0, 
    search: Optional[str] = None, 
    current_user: dict = Depends(get_current_admin)
):
    return db.get_logs(limit=limit, offset=offset, search=search)

@app.delete("/logs")
async def delete_logs(current_user: dict = Depends(get_current_admin)):
    # Delete logs older than 3 months
    count = db.delete_old_logs(months=3)
    db.add_log(current_user["id"], current_user["username"], "DELETE_LOGS", f"Deleted {count} old logs")
    return {"status": "deleted", "count": count}

# ------------------------------------------------------
# Product Endpoints
# ------------------------------------------------------

@app.get("/products")
def get_products(
    limit: int = 20, 
    offset: int = 0, 
    search: Optional[str] = None
):
    # Public access
    return db.get_all_products(limit=limit, offset=offset, search=search)

@app.get("/products/{pid}")
def get_product_detail(pid: int):
    # Public access
    product = db.get_product_by_id(pid)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@app.post("/products")
async def create_product(
    model_name: str = Form(...),
    product_name: str = Form(""),
    price: float = Form(...),
    maintenance_time: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_admin)
):
    # Create product entry first
    pid = db.add_product(model_name, product_name, price, maintenance_time)
    
    count = 0
    for file in files:
        filename = f"{pid}_{datetime.now().timestamp()}_{file.filename}"
        filepath = os.path.join(UPLOADS_DIR, filename)
        db_path = os.path.join("uploads", filename)
        
        # Read file content
        content = await file.read()
        
        # Process and save image
        if process_and_save_image(content, filepath):
            # Extract features
            vector = ai_model.extract(filepath)
            if vector is not None:
                db.add_product_image(pid, db_path, vector)
                count += 1
            else:
                if os.path.exists(filepath):
                    os.remove(filepath)
    
    # Log
    db.add_log(current_user["id"], current_user["username"], "CREATE_PRODUCT", f"Created product {model_name} (ID: {pid})")
        
    return {"id": pid, "status": "created", "images_count": count}

# Define specific routes BEFORE generic ones
@app.post("/products/batch-delete")
def batch_delete_products(request: BatchDeleteRequest, current_user: dict = Depends(get_current_admin)):
    # Get image paths first
    images = db.get_products_images(request.ids)
    
    # Delete from DB
    db.delete_products(request.ids)
    
    # Delete files
    for path in images:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Error deleting file {path}: {e}")
    
    db.add_log(current_user["id"], current_user["username"], "BATCH_DELETE", f"Deleted products: {request.ids}")
                
    return {"status": "deleted", "count": len(request.ids)}

@app.post("/products/reorder-images")
def reorder_images(request: ReorderImagesRequest, current_user: dict = Depends(get_current_admin)):
    db.update_image_orders(request.items)
    return {"status": "ok"}

@app.put("/products/{pid}")
def update_product(pid: int, item: ProductUpdate, current_user: dict = Depends(get_current_admin)):
    db.update_product(pid, item.model_name, item.product_name, item.price, item.maintenance_time)
    db.add_log(current_user["id"], current_user["username"], "UPDATE_PRODUCT", f"Updated product ID: {pid}")
    return {"status": "updated"}

@app.delete("/products/{pid}")
def delete_product(pid: int, current_user: dict = Depends(get_current_admin)):
    # Get image paths first
    images = db.get_product_images(pid)
    
    # Delete from DB
    db.delete_product(pid)
    
    # Delete files
    for path in images:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Error deleting file {path}: {e}")
    
    db.add_log(current_user["id"], current_user["username"], "DELETE_PRODUCT", f"Deleted product ID: {pid}")
                
    return {"status": "deleted"}

@app.delete("/images/{image_id}")
def delete_image(image_id: int, current_user: dict = Depends(get_current_admin)):
    # Delete from DB and get path
    path = db.delete_image(image_id)
    
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception as e:
            print(f"Error deleting file {path}: {e}")
            
    return {"status": "deleted"}

@app.post("/products/{pid}/upload-image")
async def upload_product_image(pid: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_admin)):
    filename = f"{pid}_{datetime.now().timestamp()}_{file.filename}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    db_path = os.path.join("uploads", filename)
    
    content = await file.read()
    if process_and_save_image(content, filepath):
        vector = ai_model.extract(filepath)
        if vector is not None:
            new_id = db.add_product_image(pid, db_path, vector)
            db.add_log(current_user["id"], current_user["username"], "UPLOAD_IMAGE", f"Added image to product ID: {pid}")
            return {"status": "uploaded", "image_path": db_path, "id": new_id}
    
    if os.path.exists(filepath):
        os.remove(filepath)
    raise HTTPException(status_code=400, detail="Failed to process image")

@app.post("/recognize")
async def recognize(file: UploadFile = File(...)):
    # Public access
    
    # Save temp file
    filename = f"temp_{datetime.now().timestamp()}_{file.filename}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    try:
        content = await file.read()
        if not process_and_save_image(content, filepath):
             raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Extract features
        query_vector = ai_model.extract(filepath)
        if query_vector is None:
            raise HTTPException(status_code=400, detail="Could not process image")
        
        # Search
        candidates = db.get_all_vectors()
        
        # We need to aggregate scores by product, maybe take the best matching image
        product_scores = {}
        
        for cand in candidates:
            sim = ai_model.compute_similarity(query_vector, cand['vector'])
            pid = cand['product_id']
            
            # Keep the best score for each product
            if pid not in product_scores or sim > product_scores[pid]['score']:
                product_scores[pid] = {
                    "id": pid,
                    "product": {
                        "id": pid,
                        "model_name": cand["model_name"],
                        "product_name": cand["product_name"],
                        "price": cand["price"],
                        "maintenance_time": cand["maintenance_time"],
                        "image_path": cand["image_path"] # Best matching image
                    },
                    "score": float(sim)
                }
        
        # Convert to list and sort
        results = list(product_scores.values())
        results.sort(key=lambda x: x['score'], reverse=True)
        
        # Take top 5
        top_results = results[:5]

        # Fetch all images for these products to support gallery view
        for res in top_results:
            pid = res["id"]
            all_images = db.get_product_images(pid)
            res["product"]["images"] = all_images

        return top_results
        
    finally:
        # Cleanup temp file
        if os.path.exists(filepath):
            os.remove(filepath)

@app.post("/batch-update")
async def batch_update(file: UploadFile = File(...), current_user: dict = Depends(get_current_admin)):
    """Upload a zip file containing images in folders.
    Folder structure: 'ModelName_ProductName/image.jpg'
    """
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="File must be a zip")
        
    content = await file.read()
    try:
        zip_file = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")
    
    # Create batch directory
    batch_dir_name = f"batch_{int(datetime.now().timestamp())}"
    batch_dir_path = os.path.join(UPLOADS_DIR, batch_dir_name)
    os.makedirs(batch_dir_path, exist_ok=True)
    
    # Track created products in this batch to avoid multiple lookups for same model in zip
    # Key: model_name, Value: product_id
    batch_products = {}
    count = 0
    updated_count = 0

    for filename in zip_file.namelist():
        # Skip hidden files and directories
        if filename.startswith('__MACOSX') or filename.endswith('/'):
            continue
            
        # Fix encoding
        decoded_filename = fix_zip_filename(filename)
        
        if decoded_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.webp')):
            # Parse path: Folder/Image.jpg
            parts = decoded_filename.split('/')
            
            # Handle cases where zip might be flat or nested deeper
            if len(parts) >= 2:
                folder_name = parts[-2]
                file_name = parts[-1]
                
                # Parse folder name: Model_Name[_Price]
                parts_name = folder_name.split('_')
                
                # Default values
                model_name = parts_name[0]
                product_name = ""
                price_val = 0.0

                if len(parts_name) >= 3:
                    # Case: Model_Name_Price (CS001_PearlNecklace_199)
                    # We assume last part is price if it looks like a number
                    possible_price = parts_name[-1]
                    try:
                        price_val = float(possible_price)
                        # Name is everything in between
                        product_name = "_".join(parts_name[1:-1])
                    except ValueError:
                        # Maybe it's just a long name with underscores?
                        # Let's fallback: Model_Name (where Name has underscores)
                        product_name = "_".join(parts_name[1:])
                elif len(parts_name) == 2:
                    # Case: Model_Name OR Model_Price
                    possible_second = parts_name[1]
                    try:
                        price_val = float(possible_second)
                        # So it is Model_Price, name is empty
                        product_name = ""
                    except ValueError:
                        # It is Model_Name
                        product_name = possible_second
                else:
                    # Case: Model (CS001)
                    pass
            else:
                file_name = parts[-1]
                model_name = os.path.splitext(file_name)[0]
                product_name = ""
                price_val = 0.0

            # Clean names
            model_name = model_name.strip()
            product_name = product_name.strip()

            # Extract image data (using original filename)
            data = zip_file.read(filename)
            
            # Generate save path
            save_name = f"{model_name}_{file_name}"
            # Sanitize filename characters
            save_name = "".join([c for c in save_name if c.isalnum() or c in "._-"])
            save_path = os.path.join(batch_dir_path, save_name)
            db_path = os.path.join("uploads", batch_dir_name, save_name)
            
            # Resize and Save
            if process_and_save_image(data, save_path):
                # 1. Check if we already handled this model in this batch
                pid = batch_products.get(model_name)
                
                # 2. If not in batch, check DB
                if not pid:
                    existing_product = db.get_product_by_model(model_name)
                    if existing_product:
                        pid = existing_product['id']
                        print(f"Found existing product for model '{model_name}': ID {pid}")
                        
                        # Update product name/price if provided
                        new_name = product_name if product_name else existing_product['product_name']
                        new_price = price_val if price_val > 0 else existing_product['price']
                        
                        if new_name != existing_product['product_name'] or new_price != existing_product['price']:
                             db.update_product(pid, model_name, new_name, new_price, existing_product['maintenance_time'])
                    else:
                        # Create new
                        print(f"Creating new product for model '{model_name}'")
                        pid = db.add_product(model_name, product_name, price_val, datetime.now().strftime("%Y-%m-%d"))
                        count += 1
                    
                    batch_products[model_name] = pid
                
                # Extract features
                vector = ai_model.extract(save_path)
                
                # Add Image to Product
                if vector is not None:
                    db.add_product_image(pid, db_path, vector)
                    updated_count += 1

    db.add_log(current_user["id"], current_user["username"], "BATCH_UPDATE", f"Processed {count} new products, {updated_count} images")
    
    return {"status": "success", "processed_products_count": count, "updated_images_count": updated_count}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
