import { ProjectBundle } from '@/types';
import { calculateReproducibilityScore } from '@/lib/reproducibility';

const DEMO_PROJECT_ID = 'demo-plant-disease-detection';
const DEMO_USER_ID = 'demo-user';
const NOW = '2026-11-01T10:00:00.000Z';

const demoReproducibility = calculateReproducibilityScore({
  hasDatasetInfo: true,
  datasetEvidence: 'PlantVillage dataset (54,306 leaf images across 38 crop-disease classes, 80/20 split) [p. 3].',
  hasModelArchitecture: true,
  architectureEvidence: 'Transfer learning with MobileNetV2 / ResNet-50 backbones and GlobalAveragePooling + Dense softmax head [p. 4].',
  hasHyperparameters: true,
  hyperparametersEvidence: 'Adam optimizer, lr=1e-4, batch_size=32, input_size=224x224, dropout=0.3 [p. 5].',
  hasTrainingConfig: true,
  trainingEvidence: '25 epochs with ReduceLROnPlateau and early stopping; cross-entropy loss [p. 5].',
  hasEvaluationMetrics: true,
  metricsEvidence: 'Accuracy, Macro Precision, Macro Recall, Macro F1-Score, Confusion Matrix [p. 6].',
  hasSoftwareDependencies: false,
  dependenciesEvidence: 'Mentions PyTorch/TensorFlow conceptually; exact library versions and requirements.txt not specified in paper.',
  hasExperimentalEnvironment: false,
  environmentEvidence: 'GPU model, CUDA version, and training duration omitted from paper text.',
  challenges: [
    'Exact Python/CUDA/framework versions are omitted, creating minor version drift risk.',
    'Lab-captured PlantVillage backgrounds differ from noisy in-field agricultural photos (domain shift).',
    'Random split seed is not documented, causing slight variance across runs.',
  ],
  recommendations: [
    'Pin PyTorch >= 2.1 and torchvision versions in requirements.txt.',
    'Fix random seeds across Python, NumPy, and PyTorch for deterministic splits.',
    'Evaluate cross-dataset generalization on PlantDoc (in-the-wild leaf images).',
  ],
});

export const DEMO_PROJECT_BUNDLE: ProjectBundle = {
  project: {
    id: DEMO_PROJECT_ID,
    user_id: DEMO_USER_ID,
    title: 'Plant Disease Detection Using Deep Learning',
    description:
      'DEMO DATA — Sample end-to-end research workflow demonstrating CNN-based plant leaf disease classification from paper analysis to modular PyTorch code.',
    status: 'code_ready',
    current_stage: 7,
    stage_statuses: {
      '1': 'completed',
      '2': 'completed',
      '3': 'completed',
      '4': 'completed',
      '5': 'completed',
      '6': 'completed',
      '7': 'pending',
      '8': 'pending',
      '9': 'completed',
    },
    is_demo: true,
    created_at: NOW,
    updated_at: NOW,
  },
  paper: {
    id: 'demo-paper-1',
    project_id: DEMO_PROJECT_ID,
    user_id: DEMO_USER_ID,
    file_name: 'Plant_Disease_Detection_Deep_Learning_DEMO.pdf',
    file_size: 1842310,
    storage_path: 'demo/plant_disease_detection_demo.pdf',
    page_count: 8,
    is_scanned: false,
    ocr_applied: false,
    extraction_status: 'extracted',
    full_text_length: 14250,
    error_message: null,
    extracted_pages: [
      {
        pageNumber: 1,
        charCount: 1650,
        text: 'Plant Disease Detection Using Deep Learning. Abstract: Early identification of foliar plant diseases is critical for food security. We evaluate lightweight convolutional neural networks (MobileNetV2 and ResNet-50) on 54,306 RGB leaf images spanning 14 crop species and 38 disease classes from PlantVillage.',
      },
      {
        pageNumber: 2,
        charCount: 1820,
        text: 'Introduction & Research Gap: Manual scouting is slow and error-prone. Classical hand-crafted color/texture SVM pipelines struggle with illumination shifts and subtle early lesions. Existing heavy CNNs lack mobile deployment feasibility for smallholder farmers.',
      },
      {
        pageNumber: 3,
        charCount: 1940,
        text: 'Dataset & Preprocessing: PlantVillage images are resized to 224x224, normalized using ImageNet channel statistics, and augmented via random horizontal flips, +/-15 degree rotations, and mild brightness jitter. Dataset split: 80% training, 10% validation, 10% test.',
      },
      {
        pageNumber: 4,
        charCount: 1880,
        text: 'Proposed Methodology: A pre-trained MobileNetV2 depthwise-separable convolutional backbone extracts spatial leaf features, followed by Global Average Pooling, Dropout (p=0.3), and a 38-way softmax classification head trained via categorical cross-entropy.',
      },
      {
        pageNumber: 5,
        charCount: 1750,
        text: 'Training Configuration: Adam optimizer (initial lr=1e-4), batch size 32, 25 epochs with ReduceLROnPlateau (factor=0.5, patience=3).',
      },
      {
        pageNumber: 6,
        charCount: 1890,
        text: 'Evaluation Metrics & Paper-Reported Results: Paper reports 97.4% test accuracy and 0.971 macro F1-score on the held-out PlantVillage split.',
      },
      {
        pageNumber: 7,
        charCount: 1700,
        text: 'Limitations: Controlled laboratory backgrounds in PlantVillage limit generalization to real-field cluttered foliage and overlapping leaves.',
      },
      {
        pageNumber: 8,
        charCount: 1620,
        text: 'Future Scope: Incorporate field-captured PlantDoc images, Grad-CAM visual explainability, and INT8 quantization for offline edge inference.',
      },
    ],
    created_at: NOW,
    updated_at: NOW,
  },
  analysis: {
    id: 'demo-analysis-1',
    project_id: DEMO_PROJECT_ID,
    user_id: DEMO_USER_ID,
    research_title: 'Plant Disease Detection Using Deep Learning (DEMO DATA)',
    abstract:
      'Automated classification of 38 crop-disease categories from leaf imagery using lightweight transfer-learned CNN architectures (MobileNetV2 & ResNet-50) trained on PlantVillage [p. 1].',
    research_problem:
      'Delayed or inaccurate manual diagnosis of crop leaf diseases causes major agricultural yield losses, while heavy deep models are difficult to deploy on low-power edge devices [p. 2].',
    research_objectives: [
      'Classify 38 healthy and diseased crop leaf classes with high accuracy using transfer learning [p. 1, p. 4].',
      'Compare lightweight depthwise-separable CNNs (MobileNetV2) against heavier residual baselines (ResNet-50) [p. 1, p. 4].',
      'Establish a reproducible preprocessing and augmentation pipeline resilient to orientation and lighting variation [p. 3].',
    ],
    research_gap:
      'Classical hand-crafted feature + SVM pipelines fail under subtle lesion variations, whereas large CNNs require excessive compute for field/mobile use [p. 2].',
    proposed_solution:
      'Fine-tune an ImageNet-pretrained MobileNetV2 feature extractor with Global Average Pooling, Dropout (0.3), and a 38-class softmax classifier using augmented 224x224 leaf images [p. 4].',
    methodology: {
      summary:
        'End-to-end supervised image classification pipeline: image resizing & normalization -> geometric/photometric data augmentation -> pretrained CNN backbone -> regularized linear classifier -> macro metric evaluation [p. 3–6].',
      pipeline_steps: [
        {
          step_number: 1,
          title: 'Image Standardization & Split',
          description: 'Resize RGB leaf images to 224x224, normalize by ImageNet mean/std, and split 80/10/10 train/val/test.',
          page_ref: 'p. 3',
        },
        {
          step_number: 2,
          title: 'On-the-Fly Data Augmentation',
          description: 'Apply random horizontal flips, +-15 degree rotations, and mild brightness jitter during training.',
          page_ref: 'p. 3',
        },
        {
          step_number: 3,
          title: 'Transfer Learning Backbone',
          description: 'Extract representations using MobileNetV2 depthwise-separable convolutions followed by Global Average Pooling.',
          page_ref: 'p. 4',
        },
        {
          step_number: 4,
          title: 'Regularized Classification & Optimization',
          description: 'Apply Dropout(0.3) and 38-class softmax head optimized with Adam (lr=1e-4) and ReduceLROnPlateau for 25 epochs.',
          page_ref: 'p. 4–5',
        },
        {
          step_number: 5,
          title: 'Multi-Metric Validation',
          description: 'Evaluate accuracy, macro precision, recall, F1-score, and per-class confusion matrix on test split.',
          page_ref: 'p. 6',
        },
      ],
      architecture_details:
        'MobileNetV2 backbone (pretrained on ImageNet) -> GlobalAveragePooling2D -> Dropout(0.3) -> Linear(1280, 38) -> Softmax [p. 4].',
      hyperparameters: [
        { name: 'Input Resolution', value: '224 x 224 x 3', page_ref: 'p. 3' },
        { name: 'Optimizer', value: 'Adam (lr = 1e-4)', page_ref: 'p. 5' },
        { name: 'Batch Size', value: '32', page_ref: 'p. 5' },
        { name: 'Epochs', value: '25', page_ref: 'p. 5' },
        { name: 'Dropout Rate', value: '0.3', page_ref: 'p. 4' },
        { name: 'LR Scheduler', value: 'ReduceLROnPlateau (factor=0.5, patience=3)', page_ref: 'p. 5' },
      ],
      training_configuration:
        '25 epochs, cross-entropy loss, early stopping/LR decay monitored on validation loss [p. 5]. Hardware specs not specified in paper.',
    },
    algorithms_used: [
      { name: 'MobileNetV2 (Depthwise Separable CNN)', purpose: 'Lightweight spatial feature extraction', page_ref: 'p. 4' },
      { name: 'ResNet-50 (Baseline)', purpose: 'Comparative deep residual benchmark', page_ref: 'p. 1' },
      { name: 'Adam Optimizer', purpose: 'Adaptive first-order gradient optimization', page_ref: 'p. 5' },
    ],
    mathematical_models: [
      {
        name: 'Categorical Cross-Entropy Loss',
        equation_or_formulation: 'L = - sum_{c=1}^{C} y_c * log(p_c)',
        explanation: 'Measures divergence between one-hot ground truth disease label y and predicted softmax probability p across C=38 classes.',
        page_ref: 'p. 4',
      },
      {
        name: 'Macro-Averaged F1 Score',
        equation_or_formulation: 'F1_macro = (1/C) * sum_{c=1}^{C} (2 * P_c * R_c) / (P_c + R_c)',
        explanation: 'Evaluates balanced performance across both frequent and rare crop disease classes.',
        page_ref: 'p. 6',
      },
    ],
    technologies_used: ['Python', 'Deep Learning / CNNs', 'Transfer Learning', 'ImageNet Pretrained Weights'],
    dataset_information: {
      datasets: [
        {
          name: 'PlantVillage',
          description: 'Labeled leaf imagery across 14 crop species and 38 healthy/diseased categories.',
          size: '54,306 RGB images',
          split_info: '80% train / 10% validation / 10% test',
          page_ref: 'p. 1, p. 3',
        },
      ],
      preprocessing_steps: [
        'Resize images to 224x224 pixels [p. 3]',
        'Normalize RGB channels with ImageNet mean/std [p. 3]',
        'Random horizontal flip, +/-15° rotation, brightness jitter [p. 3]',
      ],
    },
    evaluation_metrics: [
      { metric_name: 'Test Accuracy (Paper-Reported)', reported_value: '97.4%', context: 'PlantVillage held-out 10% test split (MobileNetV2)', page_ref: 'p. 6' },
      { metric_name: 'Macro F1-Score (Paper-Reported)', reported_value: '0.971', context: 'Across all 38 crop-disease classes', page_ref: 'p. 6' },
    ],
    limitations: [
      'Controlled uniform backgrounds in PlantVillage reduce accuracy on cluttered real-field photographs [p. 7].',
      'Software versions, random seed, and GPU training hardware are not specified in the paper [Not specified].',
    ],
    future_scope: [
      'Cross-domain evaluation and fine-tuning on in-the-wild PlantDoc imagery [p. 8].',
      'Grad-CAM saliency maps for farmer-interpretable lesion localization [p. 8].',
      'INT8 post-training quantization for offline smartphone deployment [p. 8].',
    ],
    source_excerpts: [
      {
        field: 'Dataset & Scale',
        page_number: 1,
        excerpt: 'We evaluate lightweight convolutional neural networks (MobileNetV2 and ResNet-50) on 54,306 RGB leaf images spanning 14 crop species and 38 disease classes.',
      },
      {
        field: 'Training Hyperparameters',
        page_number: 5,
        excerpt: 'Adam optimizer (initial lr=1e-4), batch size 32, 25 epochs with ReduceLROnPlateau (factor=0.5, patience=3).',
      },
    ],
    ai_suggestions: [
      {
        category: 'Reproducibility Enhancement',
        suggestion: 'Use stratified splitting by crop-disease class and fix random seed=42.',
        rationale: 'Class distribution in PlantVillage is imbalanced; stratification prevents rare-class variance.',
      },
      {
        category: 'Generalization Check',
        suggestion: 'Add color-space normalization or background segmentation if deploying outside studio lighting.',
        rationale: 'Directly mitigates the controlled-background limitation noted on p. 7.',
      },
    ],
    reproducibility_assessment: demoReproducibility,
    dataset_recommendations: [
      {
        name: 'PlantVillage (Kaggle Search)',
        description: 'Canonical 54,306-image leaf disease classification benchmark across 38 classes.',
        source: 'Kaggle Datasets',
        url: 'https://www.kaggle.com/search?q=PlantVillage+in%3Adatasets',
        verification_status: 'search_link',
        format: 'JPEG / Directory-per-class',
        relevance: 'Primary dataset analyzed in the research paper.',
      },
      {
        name: 'PlantVillage / Plant Disease (Hugging Face Search)',
        description: 'Community-mirrored leaf disease classification datasets compatible with Hugging Face `datasets`.',
        source: 'Hugging Face Datasets',
        url: 'https://huggingface.co/datasets?search=plant+disease',
        verification_status: 'search_link',
        format: 'Parquet / Arrow ImageFolder',
        relevance: 'Direct programmatic loading via Python `datasets` library.',
      },
      {
        name: 'Plant Pathology / Leaf Disease (Google Dataset Search)',
        description: 'Broader field-captured agricultural disease imagery for out-of-distribution testing.',
        source: 'Google Dataset Search',
        url: 'https://datasetsearch.research.google.com/search?query=plant%20leaf%20disease%20dataset',
        verification_status: 'search_link',
        format: 'Mixed (JPG / CSV)',
        relevance: 'Addresses the paper limitation on uncontrolled field backgrounds.',
      },
    ],
    library_recommendations: [
      {
        name: 'PyTorch',
        pip_package: 'torch',
        category: 'Deep Learning Framework',
        description: 'Core tensor & neural network training library.',
        docs_url: 'https://pypi.org/project/torch/',
        verification_status: 'verified',
      },
      {
        name: 'TorchVision',
        pip_package: 'torchvision',
        category: 'Computer Vision & Pretrained Models',
        description: 'Provides pretrained MobileNetV2, ResNet-50, and image transforms.',
        docs_url: 'https://pypi.org/project/torchvision/',
        verification_status: 'verified',
      },
      {
        name: 'scikit-learn',
        pip_package: 'scikit-learn',
        category: 'Evaluation Metrics',
        description: 'Precision, recall, F1-score, and stratified train/val/test splitting.',
        docs_url: 'https://pypi.org/project/scikit-learn/',
        verification_status: 'verified',
      },
    ],
    raw_model_name: 'DEMO_DATA',
    created_at: NOW,
    updated_at: NOW,
  },
  blueprints: [
    {
      id: 'demo-bp-beginner',
      project_id: DEMO_PROJECT_ID,
      user_id: DEMO_USER_ID,
      implementation_level: 'beginner',
      experiment_title: 'Lightweight Leaf Feature Baseline (Beginner Prototype)',
      experiment_objective: 'Validate end-to-end leaf disease classification pipeline quickly on CPU using compact feature extraction and logistic/MLP classifier.',
      required_software: ['Python 3.10+', 'pip / venv'],
      hardware_requirements: { cpu: '2+ cores', ram: '4 GB', gpu: 'Not required (CPU-ready)', storage: '500 MB' },
      python_libraries: [
        { name: 'numpy', version_hint: '>=1.26', purpose: 'Array processing' },
        { name: 'scikit-learn', version_hint: '>=1.4', purpose: 'Classification & metrics' },
        { name: 'pillow', version_hint: '>=10.0', purpose: 'Image loading & resizing' },
      ],
      dataset_requirements: 'Subsampled 5-class leaf folder or built-in synthetic leaf feature validation mode.',
      input_specifications: 'RGB leaf images resized to 64x64 or 224x224',
      output_specifications: 'Predicted class label, confidence score, and JSON evaluation summary',
      step_by_step_implementation: [
        { step: 1, title: 'Load & Resize Images', details: 'Read RGB images and resize uniformly.', estimated_minutes: 10 },
        { step: 2, title: 'Extract Color Histogram & Texture Features', details: 'Compute compact RGB/HSV histograms.', estimated_minutes: 15 },
        { step: 3, title: 'Train & Evaluate Baseline Classifier', details: 'Fit LogisticRegression / MLP and print accuracy & macro-F1.', estimated_minutes: 10 },
      ],
      algorithm_explanation: 'Establishes a fast, CPU-only baseline before investing GPU time in deep CNN fine-tuning.',
      evaluation_methodology: 'Stratified 80/20 split evaluated via accuracy, macro precision, recall, and F1.',
      expected_results: 'Hypothesized ~70–80% baseline accuracy on raw color histograms (lower than deep CNNs due to lack of spatial lesion filters).',
      possible_challenges: ['Color histograms miss spatial spot geometry.'],
      estimated_complexity: 'Low (~1–2 hours)',
      is_selected: false,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'demo-bp-intermediate',
      project_id: DEMO_PROJECT_ID,
      user_id: DEMO_USER_ID,
      implementation_level: 'intermediate',
      experiment_title: 'MobileNetV2 Transfer Learning Prototype (Intermediate)',
      experiment_objective: 'Reproduce the paper core MobileNetV2 transfer-learning classifier with data augmentation, Dropout(0.3), and ReduceLROnPlateau.',
      required_software: ['Python 3.10+', 'PyTorch 2.x', 'CUDA (optional)'],
      hardware_requirements: { cpu: '4+ cores', ram: '8–16 GB', gpu: 'NVIDIA T4 / RTX 3060 (optional, works on CPU for small subsets)', storage: '3 GB' },
      python_libraries: [
        { name: 'torch', version_hint: '>=2.1', purpose: 'Model training' },
        { name: 'torchvision', version_hint: '>=0.16', purpose: 'MobileNetV2 & augmentations' },
        { name: 'scikit-learn', version_hint: '>=1.4', purpose: 'Macro P/R/F1 evaluation' },
      ],
      dataset_requirements: 'ImageFolder directory of crop-disease classes (e.g. PlantVillage) or synthetic validation tensors.',
      input_specifications: 'Batch of normalized RGB tensors [B, 3, 224, 224]',
      output_specifications: 'Logits [B, num_classes], per-epoch loss/accuracy, and test metrics JSON',
      step_by_step_implementation: [
        { step: 1, title: 'Build Dataset & Augmentations', details: 'Configure 80/10/10 stratified split with flip/rotation transforms.', estimated_minutes: 20 },
        { step: 2, title: 'Initialize MobileNetV2 Classifier', details: 'Replace classifier head with Dropout(0.3) + Linear(1280, num_classes).', estimated_minutes: 15 },
        { step: 3, title: 'Train with Adam & LR Scheduler', details: 'Run training loop for up to 25 epochs with ReduceLROnPlateau.', estimated_minutes: 45 },
        { step: 4, title: 'Evaluate Test Split', details: 'Compute accuracy, precision, recall, and macro-F1 on held-out split.', estimated_minutes: 10 },
      ],
      algorithm_explanation: 'MobileNetV2 uses inverted residuals and linear bottlenecks with depthwise-separable convolutions to drastically reduce parameter count while preserving lesion sensitivity.',
      evaluation_methodology: 'Evaluate on unseen 10% test split using Accuracy and Macro Precision/Recall/F1.',
      expected_results: 'Paper reports 97.4% accuracy on full PlantVillage; actual results depend on local training run.',
      possible_challenges: ['Class imbalance across rare crop diseases', 'CPU training is slow on all 54k images'],
      estimated_complexity: 'Moderate (~3–5 hours)',
      is_selected: true,
      created_at: NOW,
      updated_at: NOW,
    },
    {
      id: 'demo-bp-advanced',
      project_id: DEMO_PROJECT_ID,
      user_id: DEMO_USER_ID,
      implementation_level: 'advanced',
      experiment_title: 'Multi-Backbone Benchmark + Grad-CAM + Cross-Domain Evaluation (Advanced)',
      experiment_objective: 'Full reproduction comparing MobileNetV2 vs ResNet-50, adding class-weighted loss, Grad-CAM visual explanations, and cross-dataset PlantDoc evaluation.',
      required_software: ['Python 3.10+', 'PyTorch 2.x', 'CUDA 12.x'],
      hardware_requirements: { cpu: '8+ cores', ram: '32 GB', gpu: '16 GB VRAM (A10G / RTX 4080)', storage: '10 GB' },
      python_libraries: [
        { name: 'torch', version_hint: '>=2.2', purpose: 'Mixed precision AMP training' },
        { name: 'torchvision', version_hint: '>=0.17', purpose: 'Backbone comparisons' },
        { name: 'scikit-learn', version_hint: '>=1.4', purpose: 'Confusion matrix & classification report' },
      ],
      dataset_requirements: 'Full PlantVillage (54,306 images) + PlantDoc field test set.',
      input_specifications: 'RGB images [B, 3, 224, 224] with class weights',
      output_specifications: 'Comparative benchmark table, Grad-CAM heatmaps, ONNX/INT8 export',
      step_by_step_implementation: [
        { step: 1, title: 'Multi-Backbone Training Harness', details: 'Train MobileNetV2 and ResNet-50 under identical seed & split.', estimated_minutes: 90 },
        { step: 2, title: 'Grad-CAM Saliency Verification', details: 'Verify model attends to leaf lesions rather than background.', estimated_minutes: 30 },
        { step: 3, title: 'Cross-Dataset Shift Stress Test', details: 'Measure accuracy drop on real-field PlantDoc images.', estimated_minutes: 30 },
      ],
      algorithm_explanation: 'Combines comparative residual vs depthwise architectures with gradient-weighted class activation mapping to diagnose background shortcut learning.',
      evaluation_methodology: 'In-domain (PlantVillage) vs Out-of-domain (PlantDoc) macro F1 + inference latency (ms/img).',
      expected_results: 'Expected >95% in-domain accuracy; significant drop on unadapted field images revealing domain gap.',
      possible_challenges: ['Severe domain shift between lab and field photos', 'Requires GPU for rapid iteration'],
      estimated_complexity: 'High (~1–2 days)',
      is_selected: false,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  generatedCode: {
    id: 'demo-code-1',
    project_id: DEMO_PROJECT_ID,
    blueprint_id: 'demo-bp-intermediate',
    user_id: DEMO_USER_ID,
    project_name: 'plant_disease_mobilenetv2_prototype',
    implementation_level: 'intermediate',
    requirements_txt: `numpy>=1.26.0
scikit-learn>=1.4.0
pillow>=10.2.0
torch>=2.1.0
torchvision>=0.16.0
`,
    readme_md: `# Plant Disease Detection Using Deep Learning (Starter Prototype)

> **DEMO DATA** — Generated starter project aligned with the MobileNetV2 transfer-learning methodology.

## Folder Structure
- \`main.py\` — CLI entrypoint supporting real ImageFolder training or \`--demo-synthetic\` smoke verification
- \`src/config.py\` — Hyperparameters aligned with paper (lr=1e-4, dropout=0.3, 224x224)
- \`src/model.py\` — MobileNetV2 + Dropout(0.3) + Linear head
- \`src/dataset.py\` — ImageFolder loader & paper augmentations
- \`src/evaluate.py\` — Accuracy, Macro Precision, Recall, F1 computation

## Quick Start
\`\`\`bash
pip install -r requirements.txt
# Run on real PlantVillage directory:
python main.py --data-dir ./data/PlantVillage --epochs 25
# Or run offline smoke-check with synthetic tensors:
python main.py --demo-synthetic
\`\`\`
`,
    configuration_instructions:
      '1. Download PlantVillage into ./data/PlantVillage/<class_name>/*.jpg.\n2. Create a Python 3.10+ virtualenv and install requirements.txt.\n3. Run `python main.py --data-dir ./data/PlantVillage` (or `--demo-synthetic` for pipeline verification without dataset files).',
    sample_input: '--data-dir ./data/PlantVillage --epochs 25 --batch-size 32',
    expected_output_format:
      'Console training progress per epoch followed by `METRICS_JSON: {"accuracy": ..., "precision_macro": ..., "recall_macro": ..., "f1_macro": ...}`.',
    simplifications: [
      'Includes a `--demo-synthetic` fallback flag so users can verify the training/evaluation code structure before downloading the 54,306-image PlantVillage dataset.',
      'Uses standard PyTorch `ImageFolder` splitting rather than a custom manifest CSV.',
    ],
    code_explanation:
      'Modular PyTorch implementation faithfully mapping the paper pipeline: ImageNet-normalized 224x224 inputs, MobileNetV2 feature extraction, Dropout(0.3), Adam(lr=1e-4), ReduceLROnPlateau, and macro evaluation metrics.',
    files: [
      {
        path: 'src/config.py',
        language: 'python',
        description: 'Paper-aligned hyperparameters and configuration dataclass',
        content: `from dataclasses import dataclass

@dataclass
class ExperimentConfig:
    image_size: int = 224
    batch_size: int = 32
    learning_rate: float = 1e-4
    dropout: float = 0.3
    epochs: int = 25
    num_classes: int = 38
    seed: int = 42
    lr_patience: int = 3
    lr_factor: float = 0.5
`,
      },
      {
        path: 'src/model.py',
        language: 'python',
        description: 'MobileNetV2 transfer-learning classifier with Dropout(0.3)',
        content: `import torch
import torch.nn as nn
from torchvision import models


class PlantDiseaseMobileNetV2(nn.Module):
    """MobileNetV2 backbone with GlobalAveragePooling, Dropout(0.3), and linear head."""

    def __init__(self, num_classes: int = 38, dropout: float = 0.3, pretrained: bool = True) -> None:
        super().__init__()
        weights = models.MobileNet_V2_Weights.DEFAULT if pretrained else None
        backbone = models.mobilenet_v2(weights=weights)
        in_features = backbone.classifier[1].in_features
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(in_features, num_classes),
        )
        self.network = backbone

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)
`,
      },
      {
        path: 'src/dataset.py',
        language: 'python',
        description: 'Transforms and 80/10/10 dataset splitting utilities',
        content: `from pathlib import Path
from typing import Tuple
import torch
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms


def build_transforms(image_size: int = 224) -> Tuple[transforms.Compose, transforms.Compose]:
    imagenet_mean = [0.485, 0.456, 0.406]
    imagenet_std = [0.229, 0.224, 0.225]

    train_tf = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=imagenet_mean, std=imagenet_std),
    ])

    eval_tf = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=imagenet_mean, std=imagenet_std),
    ])
    return train_tf, eval_tf


def load_imagefolder_splits(data_dir: str, image_size: int, batch_size: int, seed: int = 42):
    path = Path(data_dir)
    if not path.exists():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    train_tf, eval_tf = build_transforms(image_size)
    full_dataset = datasets.ImageFolder(root=str(path), transform=train_tf)
    total = len(full_dataset)
    if total < 10:
        raise ValueError(f"Expected >=10 images in {data_dir}, found {total}.")

    train_len = int(0.8 * total)
    val_len = int(0.1 * total)
    test_len = total - train_len - val_len

    generator = torch.Generator().manual_seed(seed)
    train_ds, val_ds, test_ds = random_split(full_dataset, [train_len, val_len, test_len], generator=generator)
    val_ds.dataset.transform = eval_tf
    test_ds.dataset.transform = eval_tf

    return (
        DataLoader(train_ds, batch_size=batch_size, shuffle=True),
        DataLoader(val_ds, batch_size=batch_size, shuffle=False),
        DataLoader(test_ds, batch_size=batch_size, shuffle=False),
        len(full_dataset.classes),
    )
`,
      },
      {
        path: 'src/evaluate.py',
        language: 'python',
        description: 'Accuracy, Macro Precision, Recall, and F1 evaluation',
        content: `from typing import Dict, List
from sklearn.metrics import accuracy_score, precision_recall_fscore_support


def compute_classification_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    acc = accuracy_score(y_true, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0
    )
    return {
        "accuracy": round(float(acc), 4),
        "precision_macro": round(float(precision), 4),
        "recall_macro": round(float(recall), 4),
        "f1_macro": round(float(f1), 4),
    }
`,
      },
      {
        path: 'main.py',
        language: 'python',
        description: 'Training and evaluation CLI entrypoint',
        content: `import argparse
import json
import sys
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from src.config import ExperimentConfig
from src.dataset import load_imagefolder_splits
from src.evaluate import compute_classification_metrics
from src.model import PlantDiseaseMobileNetV2


def run_experiment(data_dir: str | None, demo_synthetic: bool, epochs: int, batch_size: int) -> None:
    cfg = ExperimentConfig(epochs=epochs, batch_size=batch_size)
    torch.manual_seed(cfg.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if demo_synthetic or not data_dir:
        print("[INFO] Running pipeline smoke verification on synthetic tensors (NOT real PlantVillage data).")
        num_classes = 5
        x_train = torch.randn(40, 3, cfg.image_size, cfg.image_size)
        y_train = torch.randint(0, num_classes, (40,))
        x_test = torch.randn(16, 3, cfg.image_size, cfg.image_size)
        y_test = torch.randint(0, num_classes, (16,))
        train_loader = DataLoader(TensorDataset(x_train, y_train), batch_size=8, shuffle=True)
        test_loader = DataLoader(TensorDataset(x_test, y_test), batch_size=8, shuffle=False)
        model = PlantDiseaseMobileNetV2(num_classes=num_classes, dropout=cfg.dropout, pretrained=False).to(device)
    else:
        train_loader, _, test_loader, num_classes = load_imagefolder_splits(
            data_dir, cfg.image_size, cfg.batch_size, cfg.seed
        )
        model = PlantDiseaseMobileNetV2(num_classes=num_classes, dropout=cfg.dropout, pretrained=True).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            loss = criterion(model(images), labels)
            loss.backward()
            optimizer.step()
            running_loss += loss.item()
        print(f"Epoch {epoch}/{cfg.epochs} - Train Loss: {running_loss / max(len(train_loader), 1):.4f}")

    model.eval()
    y_true, y_pred = [], []
    with torch.no_grad():
        for images, labels in test_loader:
            preds = model(images.to(device)).argmax(dim=1).cpu().tolist()
            y_pred.extend(preds)
            y_true.extend(labels.tolist())

    metrics = compute_classification_metrics(y_true, y_pred)
    metrics["data_mode"] = "synthetic_smoke_test" if (demo_synthetic or not data_dir) else "real_dataset"
    print("METRICS_JSON:", json.dumps(metrics))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Plant Disease Detection Prototype")
    parser.add_argument("--data-dir", type=str, default=None, help="Path to PlantVillage ImageFolder")
    parser.add_argument("--demo-synthetic", action="store_true", help="Run synthetic smoke test")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    try:
        run_experiment(args.data_dir, args.demo_synthetic, args.epochs, args.batch_size)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
`,
      },
    ],
    created_at: NOW,
    updated_at: NOW,
  },
  // IMPORTANT: Demo project has NO fake execution runs or fabricated results!
  runs: [],
  results: [],
  reports: [],
};
