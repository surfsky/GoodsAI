import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import os

# ------------------------------------------------------
# AI Model Manager
# ------------------------------------------------------
class FeatureExtractor:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FeatureExtractor, cls).__new__(cls)
            cls._instance.init()
        return cls._instance

    def init(self):
        """Initialize the model"""
        print("Loading MobileNetV3 Small model...")
        # Use MobileNetV3 Small for speed
        self.weights = models.MobileNet_V3_Small_Weights.DEFAULT
        self.model = models.mobilenet_v3_small(weights=self.weights)
        
        # Remove the classifier to get features
        # MobileNetV3 structure: features -> avgpool -> classifier
        # We want the output after avgpool, which is the feature vector
        # But standard implementation: model(x) calls classifier.
        # We can replace the classifier with Identity, but we need to check the shape.
        # Original classifier is:
        # Sequential(
        #   (0): Linear(in_features=576, out_features=1024, bias=True)
        #   (1): Hardswish()
        #   (2): Dropout(p=0.2, inplace=True)
        #   (3): Linear(in_features=1024, out_features=1000, bias=True)
        # )
        # If we replace it with Identity, we get 576-dim vector. That's good.
        
        self.model.classifier = torch.nn.Identity()
        self.model.eval()
        
        self.transform = self.weights.transforms()
        print("Model loaded successfully.")

    def extract(self, img_path):
        """Extract features from an image"""
        try:
            image = Image.open(img_path).convert('RGB')
            # Preprocess
            img_t = self.transform(image)
            batch_t = torch.unsqueeze(img_t, 0)
            
            with torch.no_grad():
                output = self.model(batch_t)
            
            # Flatten and convert to numpy
            feature_vector = output.squeeze().numpy()
            
            # Normalize vector (L2 norm) for cosine similarity
            norm = np.linalg.norm(feature_vector)
            if norm > 0:
                feature_vector = feature_vector / norm
                
            return feature_vector
        except Exception as e:
            print(f"Error extracting features: {e}")
            return None

    def compute_similarity(self, vec1, vec2):
        """Compute cosine similarity between two vectors"""
        # Since vectors are normalized, dot product is cosine similarity
        return np.dot(vec1, vec2)
