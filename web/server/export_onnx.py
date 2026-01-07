import torch
import torchvision.models as models
import os

def export_model():
    print("Loading MobileNetV3 Small model...")
    # Initialize model exactly as in model.py
    weights = models.MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    
    # Replace classifier with Identity to get features
    model.classifier = torch.nn.Identity()
    model.eval()
    
    # Create dummy input
    # Shape: (Batch Size, Channels, Height, Width)
    dummy_input = torch.randn(1, 3, 224, 224)
    
    # Output path
    output_dir = os.path.join(os.path.dirname(__file__), "../serverTS")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    output_path = os.path.join(output_dir, "model.onnx")
    
    print(f"Exporting to {output_path}...")
    
    # Export
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        verbose=True,
        input_names=['input'],
        output_names=['output'],
        opset_version=12,
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    
    print("Export complete!")

if __name__ == "__main__":
    export_model()
