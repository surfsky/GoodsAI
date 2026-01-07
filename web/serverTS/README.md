# GoodsAI Server (TypeScript)

This is the Node.js/TypeScript implementation of the GoodsAI backend, serving as a replacement or alternative to the Python backend. It provides the same API endpoints and functionality, including:

- Authentication (JWT)
- Product Management (CRUD, Batch Import)
- Image Feature Extraction (using ONNX Runtime with MobileNetV3)
- Vector Search (Cosine Similarity)
- Static File Serving

## 🛠 Prerequisites

- Node.js (v18+)
- npm

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd web/serverTS
npm install
```

### 2. Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### 3. Start Server

Run the production server (dist/index.js):

```bash
npm start
```

The server runs on port **3000** by default.

### 4. Development

Run with ts-node for development:

```bash
npm run dev
```

## 🧪 Tests

Test scripts are located in the `tests/` directory.

### API Integration Test
Verifies all major API endpoints (Login, Users, Logs, Products, Search).

```bash
npx ts-node tests/test_api.ts
```

### Image Access Test
Verifies that uploaded images are correctly served via static middleware.

```bash
npx ts-node tests/test_image_access.ts
```

### Model Debugging
Checks if the ONNX model loads and runs correctly.

```bash
npx ts-node tests/debug_model.ts
```

## 🔧 Utilities

- `fix_admin.ts`: Resets the admin password to `admin123`.
- `refresh_features.ts`: Re-extracts feature vectors for all images in the database (useful if model changes).
- `tests/check_paths.ts`: Inspects image paths stored in the database.

## 📂 Directory Structure

```text
web/serverTS/
├── src/
│   ├── index.ts        # Entry point, API routes
│   ├── database.ts     # SQLite database manager
│   ├── model.ts        # ONNX model wrapper
│   ├── auth.ts         # JWT authentication
│   └── config.ts       # Configuration
├── tests/              # Test scripts
├── dist/               # Compiled JavaScript
├── model.onnx          # Pre-trained MobileNetV3 ONNX model
└── ...
```


## 原理

当 TypeScript Server 接收并解析上传的压缩包（ /batch-update 接口）时，系统执行以下逻辑以确保上传的图像能被正确比对：

1. 文件解压与解析 ：
   
   - 使用 adm-zip 解压 ZIP 包。
   - 遍历包内文件，根据文件名（格式： 型号_名称_价格/图片名 ）解析出商品信息（型号、名称、价格）。
2. 商品信息更新/创建 ：
   
   - 根据“型号”查询数据库。
   - 如果商品已存在，则更新名称和价格。
   - 如果不存在，则创建新商品记录。
3. 图片保存与特征提取（核心比对准备） ：
   
   - 将图片保存到 uploads/batch_xxx/ 目录。
   - 关键步骤 ：调用 FeatureExtractor.getInstance().extract(imagePath) 对新图片进行特征提取，生成 576 维的特征向量。
   - 将该 特征向量 （ Float32Array ）存入数据库的 product_images 表。
4. 比对原理 ：
   
   - 后续进行“以图搜图”时，系统会提取查询图片的特征向量。
   - 然后计算查询向量与数据库中 所有已存储向量 （包括刚刚批量导入的）的余弦相似度。
   - 因此， 只要上传时成功提取并存储了特征向量，新图片即刻生效，可参与比对，无需额外的全量更新操作。
只有在 更换模型文件 （ model.onnx ）本身时，才需要运行 refresh_features.ts 脚本来刷新全库的特征向量。日常的批量导入操作是自动增量更新的。