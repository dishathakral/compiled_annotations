AI-Powered Infrared Object Detection and Annotation Toolkit

A web-based annotation system for infrared images, integrating YOLOv8, manual/auto annotation, and custom model training. Built with Flask (backend) and HTML/CSS/JS (frontend).

🔍 Overview

This toolkit streamlines annotation of IR datasets via a "data engine" loop:

Auto-generate annotations using YOLOv8
Manually review/edit them
Fine-tune models iteratively
Improve annotation quality in cycles
💡 Problem Statement

Infrared object detection requires high-quality labels. Manual annotation is time-consuming and error-prone. This toolkit reduces effort using AI-powered suggestions and an interactive interface.

🚀 Features

Auto annotation using YOLOv8
Manual annotation via HTML5 Canvas
Model fine-tuning with training parameter options
Real-time training dashboard (loss, mAP, confusion matrix)
Dataset upload & management via browser
Local project directory management
🔁 Project Workflow

Upload dataset (.zip)
Manually annotate (if needed)
Run auto-annotation with YOLOv8
Review predictions
Fine-tune model
Evaluate & iterate
🧰 Tech Stack

Frontend: HTML, CSS, JavaScript, Canvas API
Backend: Python, Flask
AI Models: YOLOv8, Grounding DINO, SAM
Libraries: OpenCV, PyYAML, Chart.js, JSON, shutil, glob

🛠️ Setup

git clone <repo-url>
cd <repo-directory>
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
Access app at: http://127.0.0.1:5000/

📸 Usage

Upload infrared image dataset (.zip)
Annotate via canvas (draw, move, resize boxes)
Auto-label with YOLOv8 (full or subset selection)
Train custom models with updated annotations
Visualize metrics and sample predictions
⚠️ Limitations

Local-only storage (no cloud/db)
Object detection only (no segmentation)
No user roles/authentication
Limited dataset management via UI
🌱 Future Scope

Add segmentation support (SAM)
Enable cloud/database storage
Multi-user project access & auth
Export annotations & trained model downloads
🙏 Acknowledgements

Developed by Disha (T2506 285)
Supervised by Dr. Aparna Akula
@ CSIR-CSIO (Council of Scientific & Industrial Research)
