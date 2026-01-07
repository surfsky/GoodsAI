# 技术架构说明

## 为什么后端使用 Python？

当前后端使用 Python 主要是因为其核心功能——**商品识别 (AI)** 深度依赖 Python 的生态库（`torch`, `torchvision`, `Pillow`）。

### 1. AI 生态垄断
PyTorch 和 torchvision 是 Python 原生库，加载和处理深度学习模型非常简单。项目中最关键的特征提取逻辑在 `model.py` 中仅需几行代码即可完成工业级模型的加载：

```python
# 加载 MobileNetV3 预训练模型
self.model = models.mobilenet_v3_small(weights=self.weights)
# 移除分类层，只保留特征提取层
self.model.classifier = torch.nn.Identity()
```

### 2. 科学计算便捷
向量归一化和余弦相似度计算使用了 `numpy`，这在 Python 中是标准且高效的操作。

## 可以迁移到 TypeScript (Node.js) 吗？

**完全可以。** 如果想将技术栈统一为全栈 TypeScript（前端 Vue/React + 后端 Node.js），方案如下：

### Web 服务层 (CRUD/API)
这部分迁移非常容易，Node.js 在 I/O 密集型任务上表现优异。
- **框架**：FastAPI -> NestJS 或 Express/Koa。
- **数据库**：SQLite -> 使用 Prisma 或 TypeORM 连接。
- **图片处理**：Pillow -> 使用 `sharp` 库（性能极佳）。

### AI 推理层 (核心难点)
由于 Node.js 不能直接运行 PyTorch 代码，可采用以下方案：

#### 方案 A：使用 ONNX Runtime (推荐)
1. 使用 Python 脚本将 `.pth` 模型导出为通用的 `.onnx` 格式。
2. 在 Node.js 中安装 `onnxruntime-node`。
3. 直接在 TypeScript 中加载 ONNX 模型进行推理。
> 这是目前最成熟的跨语言 AI 部署方案，兼具类型安全与高性能。

#### 方案 B：TensorFlow.js
使用 TF.js 加载 MobileNet 模型。需要转换模型格式，且在 Node 端性能通常略逊于 ONNX。

#### 方案 C：Python 微服务
主服务器用 TypeScript 编写，AI 识别部分保留为独立的 Python 微服务，通过 HTTP 或子进程调用。

### 3. 模型文件的管理与更新 (TypeScript Server)

当前 TypeScript 版本使用 ONNX Runtime 加载 `.onnx` 模型文件。

- **模型加载**：`model.ts` 中的 `FeatureExtractor` 类会在初始化时加载 `model.onnx` 文件。
- **模型文件更新**：
  - 如果需要更新模型（例如使用新的架构或重新训练），需要先在 Python 环境中导出新的 ONNX 模型。
  - 项目提供了 `web/server/export_onnx.py` 脚本，运行该脚本会将 Python 版本的模型转换为 ONNX 格式并保存到 `web/serverTS/model.onnx`。
- **特征向量更新**：
  - 模型更新后，数据库中已存储的旧特征向量（基于旧模型提取）将失效，导致无法正确匹配。
  - **必须**重新提取所有图片的特征向量。
  - 项目提供了 `web/serverTS/refresh_features.ts` 脚本，用于遍历数据库中的所有图片，使用新模型重新计算特征向量并更新到数据库。
  - **操作步骤**：
    1. 替换 `model.onnx` 文件。
    2. 运行 `npx ts-node refresh_features.ts`。
    3. 重启 Server。
