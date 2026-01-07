import path from 'path';

export const CONFIG = {
    PORT: 3000, // Or 8000 if we want to replace the python server directly, but let's use 3000 for now or user might want to run in parallel. I'll use 3001 to avoid conflict.
    // Actually, let's use 3001.
    DB_PATH: path.resolve(__dirname, '../../server/goods.db'),
    UPLOAD_DIR: path.resolve(__dirname, '../../server/uploads'),
    MODEL_PATH: path.resolve(__dirname, '../model.onnx'),
    JWT_SECRET: "goodsai_secret_key_change_me_in_production", // Matches python version
    JWT_ALGORITHM: "HS256"
};

// Ensure upload dir exists (though it should since we point to existing one)
import fs from 'fs';
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
    fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}
