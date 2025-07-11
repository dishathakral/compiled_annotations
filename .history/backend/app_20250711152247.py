

# Minimal in-memory training status for frontend
TRAINING_STATUS = {}


import os
import zipfile
import random
import json
import yaml
import time
from flask import Flask, request, jsonify, send_from_directory, stream_with_context, Response
from flask_cors import CORS
import threading


app = Flask(__name__)
CORS(app)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECTS_DIR = os.path.join(BASE_DIR, 'projects')
os.makedirs(PROJECTS_DIR, exist_ok=True)


# Endpoint to keep the fine-tuned model for a project
@app.route('/api/projects/<project_name>/keep_model', methods=['POST'])
def keep_model(project_name):
    import shutil
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    models_dir = os.path.join(project_dir, 'models')
    os.makedirs(models_dir, exist_ok=True)
    src_weights = os.path.join(BASE_DIR, 'runs', 'detect', 'train', 'weights', 'best.pt')
    if not os.path.exists(src_weights):
        return jsonify({'success': False, 'message': 'No trained model weights found.'}), 404
    # Name and versioning
    model_name = 'base_model.pt'
    dst_weights = os.path.join(models_dir, model_name)
    try:
        shutil.copy2(src_weights, dst_weights)
    except PermissionError:
        return jsonify({'success': False, 'message': 'Model file is currently in use. Please wait for training to finish and try again.'}), 423
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error saving model: {str(e)}'}), 500
    # Optionally, record model info (versioning, date, etc.)
    info_path = os.path.join(models_dir, 'model_info.json')
    import datetime
    info = {
        'model_name': model_name,
        'version': 1,
        'saved_at': datetime.datetime.now().isoformat(),
        'source': 'runs/detect/train/weights/best.pt'
    }
    with open(info_path, 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2)
    return jsonify({'success': True, 'message': f'Model saved as {model_name} in project {project_name}.'})



# Model Performance Page (HTML)
@app.route('/projects/<project_name>/model_performance')
def model_performance(project_name):
    results_path = os.path.join(BASE_DIR, 'runs', 'detect', 'train', 'results.csv')
    metrics = {
        'last_epoch': '-',
        'last_train_loss': '-',
        'last_val_loss': '-',
        'last_map_50': '-',
        'last_map_5095': '-',
        'last_precision': '-',
        'last_recall': '-',
    }
    if os.path.exists(results_path):
        import csv
        with open(results_path, 'r', encoding='utf-8') as f:
            reader = list(csv.DictReader(f))
            if reader:
                last = reader[-1]
                metrics['last_epoch'] = last.get('epoch', '-')
                metrics['last_train_loss'] = f"{float(last.get('train/box_loss',0))+float(last.get('train/cls_loss',0))+float(last.get('train/dfl_loss',0)):.4f}"
                metrics['last_val_loss'] = f"{float(last.get('val/box_loss',0))+float(last.get('val/cls_loss',0))+float(last.get('val/dfl_loss',0)):.4f}"
                metrics['last_map_50'] = last.get('metrics/mAP50(B)', '-')
                metrics['last_map_5095'] = last.get('metrics/mAP50-95(B)', '-')
                metrics['last_precision'] = last.get('metrics/precision(B)', '-')
                metrics['last_recall'] = last.get('metrics/recall(B)', '-')
    from flask import render_template
    return render_template('model_performance.html', **metrics)

# Model Performance JSON API for JS
@app.route('/api/projects/<project_name>/model_performance_json')
def model_performance_json(project_name):
    results_path = os.path.join(BASE_DIR, 'runs', 'detect', 'train', 'results.csv')
    metrics = {
        'last_epoch': '-',
        'last_train_loss': '-',
        'last_val_loss': '-',
        'last_map_50': '-',
        'last_map_5095': '-',
        'last_precision': '-',
        'last_recall': '-',
    }
    if os.path.exists(results_path):
        import csv
        with open(results_path, 'r', encoding='utf-8') as f:
            reader = list(csv.DictReader(f))
            if reader:
                last = reader[-1]
                metrics['last_epoch'] = last.get('epoch', '-')
                metrics['last_train_loss'] = f"{float(last.get('train/box_loss',0))+float(last.get('train/cls_loss',0))+float(last.get('train/dfl_loss',0)):.4f}"
                metrics['last_val_loss'] = f"{float(last.get('val/box_loss',0))+float(last.get('val/cls_loss',0))+float(last.get('val/dfl_loss',0)):.4f}"
                metrics['last_map_50'] = last.get('metrics/mAP50(B)', '-')
                metrics['last_map_5095'] = last.get('metrics/mAP50-95(B)', '-')
                metrics['last_precision'] = last.get('metrics/precision(B)', '-')
                metrics['last_recall'] = last.get('metrics/recall(B)', '-')
    return jsonify(metrics)

# Remove an image from a subset JSON file for a project
@app.route('/api/projects/<project_name>/remove_from_subset', methods=['POST'])
def remove_from_subset(project_name):
    data = request.get_json() or {}
    subset = data.get('subset')
    image = data.get('image')
    if not subset or not image:
        return jsonify({'error': 'Missing subset or image'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    subset_path = os.path.join(project_dir, subset)
    if not os.path.exists(subset_path):
        return jsonify({'error': 'Subset file not found'}), 404
    try:
        with open(subset_path, 'r', encoding='utf-8') as f:
            subset_data = json.load(f)
        images = subset_data.get('images', [])
        if image in images:
            images.remove(image)
            subset_data['images'] = images
            with open(subset_path, 'w', encoding='utf-8') as f:
                json.dump(subset_data, f, indent=2)
        return jsonify({'message': f'Removed {image} from {subset}.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# --- Custom Training Endpoint ---
@app.route('/api/projects/<project_name>/custom_train', methods=['POST'])
def custom_train(project_name):
    data = request.get_json() or {}
    epochs = int(data.get('epochs', 10))
    model_version = data.get('model_version', 'yolov8n.pt')

    # Set status to started
    TRAINING_STATUS[project_name] = {'status': 'started', 'error': None}

    import shutil
    from ultralytics import YOLO
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PROJECTS_DIR = os.path.join(BASE_DIR, 'backend', 'projects')
    MODELS_DIR = os.path.join(BASE_DIR, 'models', 'yolov8')
    # Ensure YOLO dataset is created inside the project folder, not globally
    PROJECT_DIR = os.path.join(PROJECTS_DIR, project_name)
    YOLO_DATASET_DIR = os.path.join(PROJECT_DIR, 'yolo_dataset')
    OUT_IMG_DIR = os.path.join(YOLO_DATASET_DIR, 'images')
    OUT_LBL_DIR = os.path.join(YOLO_DATASET_DIR, 'labels')
    DATA_YAML = os.path.join(YOLO_DATASET_DIR, 'data.yaml')
    IMG_SIZE = 640
    BATCH_SIZE = 16
    TRAIN_SPLIT = 0.8


    # --- Get number of images for response ---
    ann_path = os.path.join(PROJECT_DIR, 'manual_annotations.json')
    num_images = 0
    if os.path.exists(ann_path):
        with open(ann_path, 'r', encoding='utf-8') as f:
            ann_data = json.load(f)
            num_images = len(ann_data.get('images', {}))

    def run_training():
        print(f"[TRAIN] Starting training for project: {project_name}, model: {model_version}, epochs: {epochs}")
        # Remove and recreate YOLO dataset directory for this project
        if os.path.exists(YOLO_DATASET_DIR):
            shutil.rmtree(YOLO_DATASET_DIR)
        for folder in [os.path.join(OUT_IMG_DIR, 'train'), os.path.join(OUT_IMG_DIR, 'val'),
                       os.path.join(OUT_LBL_DIR, 'train'), os.path.join(OUT_LBL_DIR, 'val')]:
            os.makedirs(folder, exist_ok=True)
        ann_path = os.path.join(PROJECT_DIR, 'manual_annotations.json')
        img_dir = os.path.join(PROJECT_DIR, 'images')
        yolo_model = os.path.join(MODELS_DIR, model_version)
        # Do not create MODELS_DIR if it doesn't exist; just check for model file
        if not os.path.isfile(yolo_model):
            print(f"[TRAIN] ❌ Model file not found: {yolo_model}")
            TRAINING_STATUS[project_name] = {'status': 'error', 'error': f'Model file not found: {yolo_model}'}
            return
        with open(ann_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        label_map = {name: i for i, name in enumerate(data['categories'])}
        image_names = list(data['images'].keys())
        random.shuffle(image_names)
        split_index = int(len(image_names) * TRAIN_SPLIT)
        train_images = image_names[:split_index]
        val_images = image_names[split_index:] if TRAIN_SPLIT < 1.0 else []
        def export_images_and_labels(image_list, split_folder):
            for img_name in image_list:
                info = data['images'][img_name]
                src_img = os.path.join(img_dir, img_name)
                dst_img = os.path.join(OUT_IMG_DIR, split_folder, img_name)
                if not os.path.exists(src_img):
                    print(f"[TRAIN] ⚠️ Warning: image not found: {src_img}")
                    continue
                shutil.copy2(src_img, dst_img)
                w, h = info['width'], info['height']
                label_lines = []
                for ann in info['annotations']:
                    class_id = label_map[ann['label']]
                    x, y, bw, bh = ann['bbox']
                    x_c = (x + bw / 2) / w
                    y_c = (y + bh / 2) / h
                    bw_n = bw / w
                    bh_n = bh / h
                    label_lines.append(f"{class_id} {x_c:.6f} {y_c:.6f} {bw_n:.6f} {bh_n:.6f}")
                label_file = os.path.join(OUT_LBL_DIR, split_folder, os.path.splitext(img_name)[0] + '.txt')
                with open(label_file, 'w') as f:
                    f.write('\n'.join(label_lines))
        export_images_and_labels(train_images, 'train')
        if TRAIN_SPLIT < 1.0:
            export_images_and_labels(val_images, 'val')
        # Always use the YOLO_DATASET_DIR inside the project for training
        train_path = os.path.join(YOLO_DATASET_DIR, 'images', 'train')
        val_path = train_path if TRAIN_SPLIT == 1.0 else os.path.join(YOLO_DATASET_DIR, 'images', 'val')
        # For YOLO, the data.yaml expects relative paths from the data.yaml location
        rel_train_path = os.path.relpath(train_path, YOLO_DATASET_DIR)
        rel_val_path = os.path.relpath(val_path, YOLO_DATASET_DIR)
        with open(DATA_YAML, 'w') as f:
            f.write(f"""train: {rel_train_path}\nval: {rel_val_path}\nnc: {len(label_map)}\nnames: {list(label_map.keys())}\n""")
        print("[TRAIN] ✅ Export complete.")
        print(f"[TRAIN] ✔️ Dataset YAML: {DATA_YAML}")
        print(f"[TRAIN] ✔️ Images path: {rel_train_path}")
        print("[TRAIN] 🚀 Training started.")
        est_time = epochs * 5
        print(f"[TRAIN] Estimated time: ~{est_time} seconds for {epochs} epochs.")
        try:
            model = YOLO(yolo_model)
            print(f"[TRAIN] Starting YOLO training for {epochs} epochs...")
            model.train(
                data=DATA_YAML,
                epochs=epochs,
                imgsz=IMG_SIZE,
                verbose=False,
                exist_ok=True,
                freeze=10,
                device="cpu",
                batch=16,
                optimizer="SGD",
                cache=True,
                rect=True,
                amp=False,                # disable mixed precision for full determinism
                deterministic=True,       # reproducible runs
                pretrained=True,
                single_cls=False,
                val=True,

                # Disable augmentations here:
                hsv_h=0.0,
                hsv_s=0.0,
                hsv_v=0.0,
                degrees=0.0,
                translate=0.0,
                scale=0.0,
                shear=0.0,
                perspective=0.0,
                flipud=0.0,
                fliplr=0.0,
                mosaic=0.0,
                mixup=0.0,
                copy_paste=0.0,
                auto_augment=None,
                erasing=0.0,

                # LR + losses
                lr0=0.01,
                lrf=0.01,
                momentum=0.937,
                weight_decay=0.0005,
                warmup_epochs=3.0,
                warmup_momentum=0.8,
                warmup_bias_lr=0.1,

            )
            print("[TRAIN] ✅ Training completed.")
            TRAINING_STATUS[project_name] = {'status': 'completed', 'error': None}
        except Exception as e:
            print(f"[TRAIN] ❌ Training error: {str(e)}")
            TRAINING_STATUS[project_name] = {'status': 'error', 'error': str(e)}
        print("[TRAIN] ---END---")
    threading.Thread(target=run_training, daemon=True).start()
    return jsonify({'status': 'started', 'message': f'Training started for {epochs} epochs on {model_version} with {num_images} images.', 'epochs': epochs, 'model_version': model_version, 'num_images': num_images})
# --- Custom Training Status Endpoint ---
@app.route('/api/projects/<project_name>/custom_train_status', methods=['GET'])
def custom_train_status(project_name):
    status = TRAINING_STATUS.get(project_name)
    if not status:
        return jsonify({'status': 'idle', 'message': 'No training in progress.'})
    return jsonify(status)

@app.route('/api/projects/<project_name>/custom_train_events')
def custom_train_events(project_name):
    def event_stream():
        last_status = None
        while True:
            status = TRAINING_STATUS.get(project_name, {}).get('status', '')
            if status != last_status:
                yield f"data: {status}\n\n"
                last_status = status
            time.sleep(1)
    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    }
    return Response(stream_with_context(event_stream()), headers=headers)

# Remove the old polling endpoint
def remove_custom_train_status():
    pass




# Serve manual_annotations.json for frontend direct fetch
@app.route('/projects/<project_name>/manual_annotations.json')
def serve_manual_annotations_json(project_name):
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    ann_path = os.path.join(project_dir, 'manual_annotations.json')
    if not os.path.exists(ann_path):
        return jsonify({'images': {}, 'categories': []})
    return send_from_directory(project_dir, 'manual_annotations.json')


try:
    from ultralytics import YOLO
    import cv2
except ImportError:
    YOLO = None
    cv2 = None

# In-memory store for auto-annotate requests
AUTO_ANNOTATE_REQUESTS = {}

MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'models'))
CONFIG_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'config'))
MODELS_YAML = os.path.join(CONFIG_DIR, 'models.yaml')
LABELS_FILE = os.path.join(CONFIG_DIR, 'labels.txt')


# Serve the main frontend page
from flask import render_template

@app.route('/')
def home():
    return render_template('index.html')
@app.route('/api/projects/<project_name>/delete_subset', methods=['POST'])
def delete_subset(project_name):
    """Delete a subset folder and its JSON for a project."""
    data = request.get_json() or {}
    subset_name = data.get('subset_name')
    if not subset_name:
        return jsonify({'error': 'No subset_name provided'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    subset_dir = os.path.join(project_dir, subset_name)
    if not os.path.exists(subset_dir):
        return jsonify({'error': 'Subset not found'}), 404
    try:
        # Remove all files in the subset directory, then the directory itself
        for root, dirs, files in os.walk(subset_dir, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))
        os.rmdir(subset_dir)
        return jsonify({'message': f'Subset {subset_name} deleted.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def list_projects():
    projects = os.listdir(PROJECTS_DIR)
    return jsonify(projects)


@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json() or {}
    project_name = data.get('project_name')
    if not project_name:
        return jsonify({'error': 'No project name provided'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    images_dir = os.path.join(project_dir, 'images')
    if not os.path.exists(images_dir):
        os.makedirs(images_dir)
        return jsonify({'message': f"Project '{project_name}' created!"})
    else:
        return jsonify({'error': f"Project '{project_name}' already exists."}), 400

# --- DELETE endpoint for project deletion ---
@app.route('/api/projects/<project_name>', methods=['DELETE'])
def delete_project(project_name):
    import shutil
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': f"Project '{project_name}' does not exist."}), 404
    try:
        shutil.rmtree(project_dir)
        return jsonify({'message': f"Project '{project_name}' deleted successfully."})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<project_name>/upload', methods=['POST'])
def upload_zip(project_name):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    images_dir = os.path.join(project_dir, 'images')
    os.makedirs(images_dir, exist_ok=True)
    SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".bmp")
    with zipfile.ZipFile(file.stream) as z:
        valid_files = [f for f in z.namelist() if f.lower().endswith(SUPPORTED_EXTS)]
        for f in valid_files:
            filename = os.path.basename(f)
            if filename:
                with z.open(f) as source, open(os.path.join(images_dir, filename), "wb") as target:
                    target.write(source.read())
    return jsonify({'message': f"Uploaded {len(valid_files)} image(s)!"})

@app.route('/projects/<project_name>/images/<filename>')
def serve_image(project_name, filename):
    images_dir = os.path.join(PROJECTS_DIR, project_name, 'images')
    return send_from_directory(images_dir, filename)

@app.route('/projects/<project_name>/images/', methods=['GET'])
def list_images(project_name):
    images_dir = os.path.join(PROJECTS_DIR, project_name, 'images')
    if not os.path.exists(images_dir):
        return jsonify([])
    files = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    return jsonify(files)

@app.route('/api/projects/<project_name>/save_annotations', methods=['POST'])
def save_annotations(project_name):
    data = request.get_json()
    if not data or 'images' not in data:
        return jsonify({'error': 'Invalid annotation data'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    out_path = os.path.join(project_dir, 'manual_annotations.json')
    try:
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return jsonify({'message': 'Annotations saved successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<project_name>/save_annotation', methods=['POST'])
def save_single_annotation(project_name):
    data = request.get_json()
    if not data or 'file_name' not in data or 'width' not in data or 'height' not in data or 'annotations' not in data:
        return jsonify({'error': 'Invalid annotation data'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    out_path = os.path.join(project_dir, 'manual_annotations.json')
    # Load existing annotations.json or create new structure
    if os.path.exists(out_path):
        with open(out_path, 'r', encoding='utf-8') as f:
            all_data = json.load(f)
    else:
        all_data = {"images": {}, "categories": []}
    # Update or add the image annotation
    all_data["images"][data['file_name']] = {
        "width": data['width'],
        "height": data['height'],
        "annotations": data['annotations']
    }
    # Update categories if new labels are present
    for ann in data['annotations']:
        label = ann.get('label') or ann.get('category')
        if label and label not in all_data['categories']:
            all_data['categories'].append(label)
    # Save back
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2)
    return jsonify({'message': f"Annotation for {data['file_name']} saved!"})

@app.route('/api/projects/<project_name>/images', methods=['GET'])
def get_project_images(project_name):
    images_dir = os.path.join(PROJECTS_DIR, project_name, 'images')
    if not os.path.exists(images_dir):
        return jsonify([])
    files = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    return jsonify(files)

# API: Get images in project
@app.route('/api/projects/<project_name>/images', methods=['GET'])
def get_images(project_name):
    images_dir = os.path.join(PROJECTS_DIR, project_name, 'images')
    if not os.path.exists(images_dir):
        return jsonify([])

    files = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    return jsonify(files)

@app.route('/api/projects/<project_name>/auto_annotate_request', methods=['POST'])
def save_auto_annotate_request(project_name):
    data = request.get_json() or {}
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    images_dir = os.path.join(project_dir, 'images')
    if not os.path.exists(images_dir):
        return jsonify({'error': 'Images directory does not exist'}), 404
    all_images = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    if not all_images:
        return jsonify({'error': 'No images found'}), 404
    # Find next available subset_N folder
    n = 1
    while os.path.exists(os.path.join(project_dir, f'subset_{n}')):
        n += 1
    subset_dir = os.path.join(project_dir, f'subset_{n}')
    os.makedirs(subset_dir, exist_ok=True)
    subset_json_path = os.path.join(subset_dir, f'subset_{n}.json')
    try:
        with open(subset_json_path, 'w', encoding='utf-8') as f:
            json.dump({'images': all_images}, f, indent=2)
        return jsonify({'message': f'Complete dataset subset created as subset_{n}/{f"subset_{n}.json"} with {len(all_images)} images.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<project_name>/create_manual_subset', methods=['POST'])
def create_manual_subset(project_name):
    data = request.get_json() or {}
    images = data.get('images', [])
    if not images:
        return jsonify({'error': 'No images provided'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    # Find next available subset_N folder
    n = 1
    while os.path.exists(os.path.join(project_dir, f'subset_{n}')):
        n += 1
    subset_dir = os.path.join(project_dir, f'subset_{n}')
    os.makedirs(subset_dir, exist_ok=True)
    subset_json_path = os.path.join(subset_dir, f'subset_{n}.json')
    try:
        with open(subset_json_path, 'w', encoding='utf-8') as f:
            json.dump({'images': images}, f, indent=2)
        return jsonify({'message': f'Manual subset created as subset_{n}/{f"subset_{n}.json"} with {len(images)} images.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<project_name>/create_random_subset', methods=['POST'])
def create_random_subset(project_name):
    data = request.get_json() or {}
    percent = data.get('percent')
    if percent is None:
        return jsonify({'error': 'No percent provided'}), 400
    try:
        percent = float(percent)
        if percent <= 0 or percent > 100:
            raise ValueError
    except Exception:
        return jsonify({'error': 'Invalid percent value'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    images_dir = os.path.join(project_dir, 'images')
    if not os.path.exists(images_dir):
        return jsonify({'error': 'Images directory does not exist'}), 404
    all_images = [f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]
    if not all_images:
        return jsonify({'error': 'No images found'}), 404
    k = max(1, int(len(all_images) * percent / 100.0))
    selected = random.sample(all_images, k)
    # Find next available subset_N folder
    n = 1
    while os.path.exists(os.path.join(project_dir, f'subset_{n}')):
        n += 1
    subset_dir = os.path.join(project_dir, f'subset_{n}')
    os.makedirs(subset_dir, exist_ok=True)
    subset_json_path = os.path.join(subset_dir, f'subset_{n}.json')
    try:
        with open(subset_json_path, 'w', encoding='utf-8') as f:
            json.dump({'images': selected}, f, indent=2)
        return jsonify({'message': f'Random subset created as subset_{n}/{f"subset_{n}.json"} with {len(selected)} images.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/list', methods=['GET'])
def list_models():
    result = {}
    allowed_exts = ('.pt', '.pth', '.onnx', '.ckpt', '.bin', '.h5', '.tflite')
    if not os.path.exists(MODELS_DIR):
        print(f"MODELS_DIR does not exist: {MODELS_DIR}")
        return jsonify(result)
    for family in os.listdir(MODELS_DIR):
        fam_path = os.path.join(MODELS_DIR, family)
        if os.path.isdir(fam_path):
            versions = [f for f in os.listdir(fam_path)
                        if os.path.isfile(os.path.join(fam_path, f)) and f.lower().endswith(allowed_exts)]
            if versions:
                result[family] = versions
    print(f"/api/models/list result: {result}")  # Debug print
    return jsonify(result)

@app.route('/api/models/families', methods=['GET'])
def get_model_families():
    if not os.path.exists(MODELS_DIR):
        return jsonify([])
    families = [f for f in os.listdir(MODELS_DIR) if os.path.isdir(os.path.join(MODELS_DIR, f))]
    return jsonify(families)

@app.route('/api/models/versions', methods=['GET'])
def get_model_versions():
    family = request.args.get('family')
    if not family:
        return jsonify([])
    fam_path = os.path.join(MODELS_DIR, family)
    allowed_exts = ('.pt', '.pth', '.onnx', '.ckpt', '.bin', '.h5', '.tflite')
    if not os.path.isdir(fam_path):
        return jsonify([])
    versions = [f for f in os.listdir(fam_path) if os.path.isfile(os.path.join(fam_path, f)) and f.lower().endswith(allowed_exts)]
    return jsonify(versions)

@app.route('/api/models/descriptions', methods=['GET'])
def get_model_descriptions():
    if not os.path.exists(MODELS_YAML):
        return jsonify({})
    with open(MODELS_YAML, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return jsonify(data.get('models', {}))

@app.route('/api/labels', methods=['GET', 'POST'])
def manage_labels():
    project_name = request.args.get('project')
    if not project_name:
        return jsonify({'error': 'Project name required'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    labels_file = os.path.join(project_dir, 'labels.txt')
    if request.method == 'POST':
        data = request.get_json() or {}
        label = data.get('label', '').strip()
        if not label:
            return jsonify({'error': 'No label provided'}), 400
        # Append label to file if not already present
        labels = []
        if os.path.exists(labels_file):
            with open(labels_file, 'r', encoding='utf-8') as f:
                labels = [l.strip() for l in f if l.strip()]
        if label in labels:
            return jsonify({'error': 'Label already exists'}), 400
        with open(labels_file, 'a', encoding='utf-8') as f:
            f.write(label + '\n')
        return jsonify({'message': f'Label "{label}" added.'})
    else:
        labels = []
        if os.path.exists(labels_file):
            with open(labels_file, 'r', encoding='utf-8') as f:
                labels = [l.strip() for l in f if l.strip()]
        return jsonify({'labels': labels})

@app.route('/api/projects/<project_name>/subsets', methods=['GET'])
def list_subsets(project_name):
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify([])
    subsets = []
    for name in os.listdir(project_dir):
        if name.startswith('subset_') and os.path.isdir(os.path.join(project_dir, name)):
            subset_json = os.path.join(project_dir, name, f'{name}.json')
            if os.path.exists(subset_json):
                subsets.append({'name': name, 'json': f'{name}/{name}.json'})
    return jsonify(subsets)

@app.route('/projects/<project_name>/<subset_folder>/<subset_json>')
def serve_subset_json(project_name, subset_folder, subset_json):
    subset_dir = os.path.join(PROJECTS_DIR, project_name, subset_folder)
    if not os.path.exists(subset_dir):
        return jsonify({'error': 'Subset not found'}), 404
    return send_from_directory(subset_dir, subset_json)

@app.route('/api/projects/<project_name>/save_auto_annotate_config', methods=['POST'])
def save_auto_annotate_config(project_name):
    data = request.get_json() or {}
    model_family = data.get('model_family')
    model_version = data.get('model_version')
    subset = data.get('subset')
    if not (model_family and model_version and subset):
        return jsonify({'error': 'model_family, model_version, and subset are required'}), 400
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(project_dir):
        return jsonify({'error': 'Project does not exist'}), 404
    config_path = os.path.join(project_dir, 'auto_annotate_config.json')
    config = {
        'model_family': model_family,
        'model_version': model_version,
        'subset': subset
    }
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        return jsonify({'message': 'Auto-annotate config saved successfully!'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/projects/<project_name>/get_auto_annotate_config', methods=['GET'])
def get_auto_annotate_config(project_name):
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    config_path = os.path.join(project_dir, 'auto_annotate_config.json')
    if not os.path.exists(config_path):
        return jsonify({'error': 'Config not found'}), 404
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    return jsonify(config)

@app.route('/api/projects/<project_name>/run_auto_label', methods=['POST'])
def run_auto_label(project_name):
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    config_path = os.path.join(project_dir, 'auto_annotate_config.json')
    if not os.path.exists(config_path):
        return jsonify({'error': 'Auto-annotate config not found'}), 404
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    model_family = config.get('model_family')
    model_version = config.get('model_version')
    subset = config.get('subset')
    if not (model_family and model_version and subset):
        return jsonify({'error': 'Incomplete config'}), 400
    # Model path
    model_path = os.path.join(MODELS_DIR, model_family, model_version)
    if not os.path.exists(model_path):
        return jsonify({'error': f'Model file not found: {model_path}'}), 404
    # Subset path
    subset_path = os.path.join(project_dir, subset)
    if not os.path.exists(subset_path):
        return jsonify({'error': f'Subset file not found: {subset_path}'}), 404
    with open(subset_path, 'r', encoding='utf-8') as f:
        subset_data = json.load(f)
    images = subset_data.get('images', [])
    images_dir = os.path.join(project_dir, 'images')
    results = {}
    if YOLO is None:
        return jsonify({'error': 'ultralytics not installed on server'}), 500
    try:
        model = YOLO(model_path)
        for img_name in images:
            img_path = os.path.join(images_dir, img_name)
            if not os.path.exists(img_path):
                continue
            pred = model(img_path)
            # Convert prediction to serializable format (e.g., boxes, scores, classes)
            pred_data = []
            for r in pred:
                boxes = r.boxes.xyxy.cpu().numpy().tolist() if hasattr(r, 'boxes') and hasattr(r.boxes, 'xyxy') else []
                scores = r.boxes.conf.cpu().numpy().tolist() if hasattr(r, 'boxes') and hasattr(r.boxes, 'conf') else []
                classes = r.boxes.cls.cpu().numpy().tolist() if hasattr(r, 'boxes') and hasattr(r.boxes, 'cls') else []
                pred_data.append({'boxes': boxes, 'scores': scores, 'classes': classes})
            results[img_name] = pred_data
        # Save results
        out_path = os.path.join(project_dir, 'auto_annotate_results.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        return jsonify({'message': f'Auto-labeling complete! Results saved to auto_annotate_results.json', 'num_images': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

        # --- Remove annotated images from subset file ---
        # Load manual_annotations.json to get all annotated images
        manual_ann_path = os.path.join(project_dir, 'manual_annotations.json')
        annotated_set = set()
        if os.path.exists(manual_ann_path):
            with open(manual_ann_path, 'r', encoding='utf-8') as f:
                ann_data = json.load(f)
                annotated_set = set((ann_data.get('images') or {}).keys())
        # Remove any images now annotated (present in manual_annotations.json or just processed)
        new_images = [img for img in images if img not in annotated_set and img not in results.keys()]
        if len(new_images) != len(images):
            subset_data['images'] = new_images
            with open(subset_path, 'w', encoding='utf-8') as f:
                json.dump(subset_data, f, indent=2)

@app.route('/projects/<project_name>/auto_annotate_results.json')
def serve_auto_annotate_results(project_name):
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    results_path = os.path.join(project_dir, 'auto_annotate_results.json')
    if not os.path.exists(results_path):
        return jsonify({'error': 'Results file not found'}), 404
    return send_from_directory(project_dir, 'auto_annotate_results.json')

@app.route('/api/projects/<project_name>/remove_annotated_image', methods=['POST'])
def remove_annotated_image(project_name):
    data = request.get_json()
    img_name = data.get('image')
    if not img_name:
        return jsonify({'error': 'No image specified'}), 400

    project_dir = os.path.join(PROJECTS_DIR, project_name)
    ann_path = os.path.join(project_dir, 'manual_annotations.json')
    if not os.path.exists(ann_path):
        return jsonify({'error': 'manual_annotations.json not found'}), 404

    with open(ann_path, 'r', encoding='utf-8') as f:
        ann_data = json.load(f)

    if 'images' in ann_data and img_name in ann_data['images']:
        del ann_data['images'][img_name]
        with open(ann_path, 'w', encoding='utf-8') as f:
            json.dump(ann_data, f, indent=2)
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Image not found in annotations'}), 404

@app.route('/project.html')
def serve_project_html():
    return render_template('project.html')

@app.route('/auto_annotate_dataset.html')
def serve_auto_annotate_dataset_html():
    return render_template('auto_annotate_dataset.html')

@app.route('/manual_annotate.html')
def serve_manual_annotate_html():
    return render_template('manual_annotate.html')

@app.route('/view_predictions.html')
def serve_view_predictions_html():
    return render_template('view_predictions.html')

@app.route('/projects')
def serve_projects_html():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=False,host='0.0.0.0')
