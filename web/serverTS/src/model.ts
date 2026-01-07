import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import { CONFIG } from './config';
import fs from 'fs';

/**
 * 特征提取器
 */
export class FeatureExtractor {
    private static instance: FeatureExtractor;
    private session: ort.InferenceSession | null = null;
    private constructor() {}

    /**
     * 获取单例实例
     * @returns FeatureExtractor实例
     */
    public static getInstance(): FeatureExtractor {
        if (!FeatureExtractor.instance) {
            FeatureExtractor.instance = new FeatureExtractor();
        }
        return FeatureExtractor.instance;
    }

    /**
     * 初始化模型会话
     */
    async init() {
        if (this.session) return;
        console.log(`Loading ONNX model from ${CONFIG.MODEL_PATH}...`);
        try {
            this.session = await ort.InferenceSession.create(CONFIG.MODEL_PATH);
            console.log("Model loaded successfully.");
        } catch (e) {
            console.error("Failed to load ONNX model:", e);
            throw e;
        }
    }

    /**
     * 提取图像特征
     * @param imagePath 图像路径
     * @returns 特征向量（Float32Array）或null（提取失败）
     */
    async extract(imagePath: string): Promise<Float32Array | null> {
        if (!this.session) await this.init();

        try {
            const tensor = await this.preprocess(imagePath);
            const feeds: Record<string, ort.Tensor> = {};
            feeds[this.session!.inputNames[0]] = tensor;

            const results = await this.session!.run(feeds);
            const output = results[this.session!.outputNames[0]].data as Float32Array;

            // Normalize (L2)
            return this.normalizeL2(output);
        } catch (e) {
            console.error(`Error extracting features for ${imagePath}:`, e);
            return null;
        }
    }

    /**
     * 预处理图像：缩放、居中裁剪、归一化
     * @param imagePath 图像路径
     * @returns 预处理后的张量
     */
    private async preprocess(imagePath: string): Promise<ort.Tensor> {
        const image = sharp(imagePath);
        const metadata = await image.metadata();
        
        let width = metadata.width!;
        let height = metadata.height!;

        // 1. Resize: Shortest edge to 256
        const targetSize = 256;
        let newWidth, newHeight;

        if (width < height) {
            newWidth = targetSize;
            newHeight = Math.round(height * (targetSize / width));
        } else {
            newHeight = targetSize;
            newWidth = Math.round(width * (targetSize / height));
        }

        // 2. Center Crop: 224x224
        const cropSize = 224;
        
        const buffer = await image
            .resize(newWidth, newHeight)
            .extract({
                left: Math.floor((newWidth - cropSize) / 2),
                top: Math.floor((newHeight - cropSize) / 2),
                width: cropSize,
                height: cropSize
            })
            .removeAlpha()
            .raw()
            .toBuffer();

        // 3. ToTensor & Normalize
        // Layout: NCHW (1, 3, 224, 224)
        // Buffer is HWC (RGB)
        
        const floatData = new Float32Array(3 * cropSize * cropSize);
        
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        for (let i = 0; i < cropSize * cropSize; i++) {
            const r = buffer[i * 3 + 0] / 255.0;
            const g = buffer[i * 3 + 1] / 255.0;
            const b = buffer[i * 3 + 2] / 255.0;

            // NCHW: 
            // R: 0 * H * W + i
            // G: 1 * H * W + i
            // B: 2 * H * W + i
            
            floatData[i] = (r - mean[0]) / std[0]; // R plane
            floatData[cropSize * cropSize + i] = (g - mean[1]) / std[1]; // G plane
            floatData[2 * cropSize * cropSize + i] = (b - mean[2]) / std[2]; // B plane
        }

        return new ort.Tensor('float32', floatData, [1, 3, cropSize, cropSize]);
    }

    /**
     * L2 归一化
     * @param vector 输入向量
     * @returns 归一化后的向量
     */
    private normalizeL2(vector: Float32Array): Float32Array {
        let sumSq = 0;
        for (let i = 0; i < vector.length; i++) {
            sumSq += vector[i] * vector[i];
        }
        const norm = Math.sqrt(sumSq);
        if (norm > 0) {
            const normalized = new Float32Array(vector.length);
            for (let i = 0; i < vector.length; i++) {
                normalized[i] = vector[i] / norm;
            }
            return normalized;
        }
        return vector;
    }

    /**
     * 计算向量相似度（点积）
     * @param vec1 特征向量1
     * @param vec2 特征向量2
     * @returns 相似度得分（-1到1之间）
     */
    computeSimilarity(vec1: Float32Array, vec2: Float32Array): number {
        let dot = 0;
        for (let i = 0; i < vec1.length; i++) {
            dot += vec1[i] * vec2[i];
        }
        return dot;
    }
}
