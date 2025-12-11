# 🔥 AI-Powered Infrared Object Detection and Annotation Toolkit

[![Python](https://img.shields.io/badge/Python-3.7%2B-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-vision-orange.svg)](https://github.com/ultralytics/ultralytics)
[![OpenCV](https://img.shields.io/badge/OpenCV-computer%20vision-brightgreen.svg)](https://opencv.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)


A **web-based annotation system** for **infrared images**, integrating **YOLOv8**, manual/auto annotation, and custom model training.  
Built with **Flask (Backend)** and **HTML/CSS/JS (Frontend)**.

---

## 🔍 Overview

This toolkit streamlines infrared (IR) dataset annotation through a **data engine loop**:

1. Auto-generate annotations using YOLOv8  
2. Manually review and edit them  
3. Fine-tune models iteratively  
4. Improve annotation quality in cycles  

---

## 💡 Problem Statement

Infrared object detection demands **high-quality labeled data**, but manual annotation is often **time-consuming and error-prone**.  
This toolkit minimizes labeling effort with **AI-powered suggestions** and an **interactive browser-based interface**.

---

## 🚀 Features

- 🤖 **Auto Annotation:** Use YOLOv8 for automatic bounding box generation.  
- 🖍️ **Manual Annotation:** Edit and refine bounding boxes via HTML5 Canvas.  
- 🧠 **Model Fine-Tuning:** Train and re-train YOLOv8 models with custom parameters.  
- 📊 **Real-Time Dashboard:** Visualize metrics like *loss*, *mAP*, and *confusion matrix*.  
- 📁 **Dataset Management:** Upload, view, and organize datasets directly from the browser.  
- 💾 **Local Project Handling:** Manage all project files locally for privacy and flexibility.

---

## 🔁 Project Workflow

1. **Upload Dataset (.zip)**  
2. **Manually Annotate (if needed)** using the built-in Canvas tool  
3. **Run Auto-Annotation** with YOLOv8 (on all or selected images)  
4. **Review Predictions** and make corrections  
5. **Fine-Tune Model** using updated annotations  
6. **Evaluate & Iterate** using real-time training metrics  

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML, CSS, JavaScript, Canvas API |
| **Backend** | Python, Flask |
| **AI Models** | YOLOv8, Grounding DINO, SAM |
| **Libraries** | OpenCV, PyYAML, Chart.js, JSON, shutil, glob |

---

## 🛠️ Setup Instructions

```
# Clone the repository
git clone <your-repo-url>
cd <repo-folder>

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask app
python app.py
```

Access the app in your browser at:  
👉 [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 📸 Usage Guide

1. **Upload infrared image dataset (.zip)**  
2. **Annotate images manually** — draw, move, or resize bounding boxes on the Canvas  
3. **Auto-label images** using YOLOv8  
4. **Train custom models** with refined annotations  
5. **Visualize results** via interactive charts and prediction samples  

---

## ⚠️ Limitations

- Works on **local storage only** (no cloud integration yet)  
- Supports **object detection only** — no segmentation  
- Lacks **user roles/authentication**  
- Limited dataset management capabilities through UI  

---

## 🌱 Future Scope

- 🧩 **Segmentation Support** with SAM integration  
- ☁️ **Cloud & Database Storage** for collaborative use  
- 👥 **Multi-user Authentication and Project Access**  
- ⬇️ **Export Options** for annotations and trained models  

---

## 🙏 Acknowledgements

Developed by **Disha (T2506 285)**  
Supervised by **Dr. Aparna Akula**  
**CSIR-CSIO (Council of Scientific & Industrial Research)**

---

## 📜 License

This project is licensed under the **MIT License** — feel free to use and modify.

---
```
