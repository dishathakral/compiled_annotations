let projectName = '';
let images = [];
let currentImageIdx = 0;
let labels = ['Person', 'Car', 'Dog'];
let boxes = []; // [{x, y, w, h, label}]
let selectedBoxIdx = null;
let dragMode = null; // 'move', 'resize', or null
let dragOffset = {x:0, y:0};
let dragCorner = null;
let mode = 'draw'; // 'draw' or 'transform'
let currentMode = 'draw'; // 'draw', 'pan', 'zoomIn', 'zoomOut', 'reset'

// --- ZOOM & PAN STATE ---
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStart = {x:0, y:0};

function getProjectName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('name');
}

function fetchImages() {
  return fetch(`/projects/${encodeURIComponent(projectName)}/images/`)
    .then(res => res.json())
    .catch(() => []);
}

function fetchAnnotations(imgName) {
  // Try to fetch annotation for this image, fallback to empty array
  return fetch(`/api/projects/${encodeURIComponent(projectName)}/annotations?image=${encodeURIComponent(imgName)}`)
    .then(res => res.json())
    .catch(() => []);
}

function saveAnnotations(imgName, boxes) {
  return fetch(`/api/projects/${encodeURIComponent(projectName)}/annotate`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ image: imgName, boxes })
  }).then(res => res.json());
}

// --- Annotated/Unannotated Toggle Logic ---
let allImages = [];
let annotatedImages = [];
let unannotatedImages = [];
let annotationMap = {};
let currentTab = 'unannotated'; // 'annotated' or 'unannotated'

async function fetchAnnotationMap() {
  // Fetch manual_annotations.json for this project
  const resp = await fetch(`/projects/${encodeURIComponent(projectName)}/manual_annotations.json`);
  if (!resp.ok) return {};
  const data = await resp.json();
  return data.images || {};
}

function updateImageLists() {
  annotatedImages = [];
  unannotatedImages = [];
  allImages.forEach(img => {
    if (annotationMap[img]) {
      annotatedImages.push(img);
    } else {
      unannotatedImages.push(img);
    }
  });
}

function renderTabSelector() {
  const listDiv = document.getElementById('imageList');
  let html = `<div style="display:flex;justify-content:center;margin-bottom:10px;gap:8px;">
    <button id="tabUnannotated" class="anno-btn btn btn-sm ${currentTab==='unannotated'?'btn-primary':'btn-light'}">Unannotated (${unannotatedImages.length})</button>
    <button id="tabAnnotated" class="anno-btn btn btn-sm ${currentTab==='annotated'?'btn-primary':'btn-light'}">Annotated (${annotatedImages.length})</button>
  </div>`;
  listDiv.innerHTML = html + listDiv.innerHTML;
  document.getElementById('tabUnannotated').onclick = () => {
    if (currentTab !== 'unannotated') {
      currentTab = 'unannotated';
      images = unannotatedImages;
      currentImageIdx = 0;
      renderImageList();
      if (images.length > 0) {
        loadImage();
      } else {
        document.getElementById('imageName').innerText = '';
        document.getElementById('annoMsg').innerText = 'No unannotated images.';
      }
    }
  };
  document.getElementById('tabAnnotated').onclick = () => {
    if (currentTab !== 'annotated') {
      currentTab = 'annotated';
      images = annotatedImages;
      currentImageIdx = 0;
      renderImageList();
      if (images.length > 0) {
        loadImage();
      } else {
        document.getElementById('imageName').innerText = '';
        document.getElementById('annoMsg').innerText = 'No annotated images.';
      }
    }
  };
}

function renderImageList() {
  const listDiv = document.getElementById('imageList');
  // Clear only the thumbnails, not the tab selector
  listDiv.innerHTML = '';
  // Render tab selector first
  renderTabSelector();
  let imgs = currentTab === 'annotated' ? annotatedImages : unannotatedImages;
  let rowDiv = null;
  imgs.forEach((img, idx) => {
    if (idx % 2 === 0) {
      rowDiv = document.createElement('div');
      rowDiv.style.display = 'flex';
      rowDiv.style.justifyContent = 'center';
      rowDiv.style.marginBottom = '8px';
      listDiv.appendChild(rowDiv);
    }
    const imgElem = document.createElement('img');
    imgElem.src = `/projects/${encodeURIComponent(projectName)}/images/${encodeURIComponent(img)}`;
    imgElem.className = 'anno-img-thumb';
    imgElem.dataset.idx = idx;
    if (idx === currentImageIdx) {
      imgElem.classList.add('selected');
    }
    imgElem.style.width = '100px';
    imgElem.style.height = '100px';
    imgElem.style.objectFit = 'cover';
    imgElem.style.marginRight = '6px';
    imgElem.style.marginBottom = '0';
    imgElem.onclick = (e) => {
      images = imgs;
      currentImageIdx = idx;
      loadImage();
      // Update selection highlight for all thumbnails
      document.querySelectorAll('.anno-img-thumb').forEach(el => el.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
    };
    rowDiv.appendChild(imgElem);
  });
  images = imgs;
  // Ensure currentImageIdx is valid
  if (images.length > 0 && (currentImageIdx < 0 || currentImageIdx >= images.length)) {
    currentImageIdx = 0;
  }
}

function renderModeSelector() {}

function renderModeActionSection() {
  const section = document.getElementById('modeActionSection');
  section.innerHTML = `
    <button id="saveBtn" class="anno-btn btn btn-primary">Save Annotations</button>
  `;
  document.getElementById('saveBtn').onclick = async function() {
    const imgName = images[currentImageIdx];
    // Get image dimensions
    let width = 0, height = 0;
    try {
      const img = new window.Image();
      img.src = `/projects/${encodeURIComponent(projectName)}/images/${encodeURIComponent(imgName)}`;
      await new Promise(resolve => { img.onload = resolve; });
      width = img.width;
      height = img.height;
    } catch {}
    // Prepare annotation data for this image
    const annotationData = {
      file_name: imgName,
      width,
      height,
      annotations: boxes.map((b, i) => ({
        id: i + 1,
        bbox: [b.x, b.y, b.w, b.h],
        label: b.label
      }))
    };
    // POST to backend
    const resp = await fetch(`/api/projects/${encodeURIComponent(projectName)}/save_annotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotationData)
    });
    const data = await resp.json();
    document.getElementById('annoMsg').innerText = data.message || data.error || 'Annotation saved!';
  };
}

function renderLabels() {
  const labelsSection = document.getElementById('labelsSection');
  labelsSection.innerHTML = '';
  boxes.forEach((box, idx) => {
    const boxDiv = document.createElement('div');
    boxDiv.style.marginBottom = '10px';
    boxDiv.style.padding = '8px';
    boxDiv.style.border = idx === selectedBoxIdx ? '2px solid #f63366' : '1px solid #ddd';
    boxDiv.style.borderRadius = '6px';
    boxDiv.style.background = idx === selectedBoxIdx ? '#fff0f4' : '#fafafa';

    const boxTitle = document.createElement('div');
    boxTitle.style.display = 'flex';
    boxTitle.style.justifyContent = 'space-between';
    boxTitle.style.alignItems = 'center';
    boxTitle.style.marginBottom = '4px';

    const titleText = document.createElement('span');
    titleText.textContent = `Box ${idx + 1}`;
    titleText.style.fontWeight = 'bold';
    boxTitle.appendChild(titleText);

    // Bin icon for delete
    const bin = document.createElement('span');
    bin.innerHTML = '🗑️';
    bin.style.cursor = 'pointer';
    bin.title = 'Delete bounding box';
    bin.onclick = (e) => {
      e.stopPropagation();
      boxes.splice(idx, 1);
      if (selectedBoxIdx === idx) selectedBoxIdx = null;
      else if (selectedBoxIdx > idx) selectedBoxIdx--;
      renderLabels();
      drawCanvasWithPreview();
    };
    boxTitle.appendChild(bin);

    boxDiv.appendChild(boxTitle);

    const sel = document.createElement('select');
    sel.className = 'anno-label-dropdown form-control';
    labels.forEach(label => {
      const opt = document.createElement('option');
      opt.value = label;
      opt.text = label;
      if (label === box.label) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => {
      box.label = sel.value;
      drawCanvasWithPreview();
    };
    boxDiv.appendChild(sel);

    boxDiv.onclick = (e) => {
      if (e.target === sel || e.target === bin) return;
      selectedBoxIdx = idx;
      drawCanvasWithPreview();
      renderLabels();
    };

    labelsSection.appendChild(boxDiv);
  });
}

function loadImage() {
  const imgName = images[currentImageIdx];
  document.getElementById('imageName').innerText = imgName;
  document.getElementById('annoMsg').innerText = '';
  // If in annotated view, fetch from manual_annotations.json directly (new format)
  if (currentTab === 'annotated' && annotationMap && annotationMap[imgName]) {
    // annotationMap[imgName] is an object: {width, height, annotations: [ ... ]}
    let annoEntry = annotationMap[imgName];
    let annoBoxes = (annoEntry && Array.isArray(annoEntry.annotations)) ? annoEntry.annotations : [];
    boxes = annoBoxes.map(b => ({
      x: b.bbox[0],
      y: b.bbox[1],
      w: b.bbox[2],
      h: b.bbox[3],
      label: b.label || (b.category_id ? (labels[b.category_id-1] || '') : '')
    }));
    renderLabels();
    selectedBoxIdx = null;
    drawCanvasWithPreview();
    return;
  }
  // Otherwise, fetch from API (unannotated or fallback)
  fetchAnnotations(imgName).then(data => {
    // Accept both COCO-style and UI-style
    if (Array.isArray(data) && data.length > 0 && data[0].bbox) {
      boxes = data.map(b => ({
        x: b.bbox[0],
        y: b.bbox[1],
        w: b.bbox[2],
        h: b.bbox[3],
        label: b.label || (b.category_id ? (labels[b.category_id-1] || '') : '')
      }));
    } else if (Array.isArray(data) && data.length > 0 && data[0].x !== undefined) {
      boxes = data;
    } else {
      boxes = [];
    }
    renderLabels();
    selectedBoxIdx = null;
    drawCanvasWithPreview();
  });
}

function drawHandles(ctx, box) {
  // Draw small squares at corners and edges for resizing
  const handles = getHandlePositions(box);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#f63366";
  handles.forEach(h => {
    ctx.beginPath();
    ctx.rect(h.x-4, h.y-4, 8, 8);
    ctx.fill();
    ctx.stroke();
  });
}

function getHandlePositions(box) {
  // Returns 8 handles: 4 corners, 4 edges
  const {x, y, w, h} = box;
  return [
    {x: x, y: y}, // top-left
    {x: x+w/2, y: y}, // top
    {x: x+w, y: y}, // top-right
    {x: x+w, y: y+h/2}, // right
    {x: x+w, y: y+h}, // bottom-right
    {x: x+w/2, y: y+h}, // bottom
    {x: x, y: y+h}, // bottom-left
    {x: x, y: y+h/2} // left
  ];
}

function hitTestHandle(mx, my, box) {
  const handles = getHandlePositions(box);
  for (let i = 0; i < handles.length; i++) {
    const h = handles[i];
    if (Math.abs(mx - h.x) <= 6 && Math.abs(my - h.y) <= 6) {
      return i;
    }
  }
  return -1;
}

function hitTestBox(mx, my, box) {
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

function setupCanvas() {
  const canvas = document.getElementById('annotateCanvas');
  let isDrawing = false;
  let isEditing = false;
  let startX = 0, startY = 0;
  let previewBox = null;
  let editBoxIdx = null;
  let editDragMode = null;
  let editDragCorner = null;
  let editDragOffset = {x:0, y:0};

  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Adjust for pan and zoom
    return {
      x: ((e.clientX - rect.left) * scaleX - panX) / zoomLevel,
      y: ((e.clientY - rect.top) * scaleY - panY) / zoomLevel
    };
  }

  // --- MODE RADIO HANDLERS ---
  document.getElementById('drawModeRadio').onchange = function() {
    if (this.checked) {
      currentMode = 'draw';
      canvas.style.cursor = 'crosshair';
    }
  };
  document.getElementById('panModeRadio').onchange = function() {
    if (this.checked) {
      currentMode = 'pan';
      canvas.style.cursor = 'grab';
    }
  };
  document.getElementById('zoomInModeRadio').onchange = function() {
    if (this.checked) {
      zoomLevel = Math.min(zoomLevel * 1.25, 8);
      drawCanvasWithPreview();
      // Return to draw mode after zoom
      document.getElementById('drawModeRadio').checked = true;
      currentMode = 'draw';
      canvas.style.cursor = 'crosshair';
    }
  };
  document.getElementById('zoomOutModeRadio').onchange = function() {
    if (this.checked) {
      zoomLevel = Math.max(zoomLevel / 1.25, 0.2);
      drawCanvasWithPreview();
      document.getElementById('drawModeRadio').checked = true;
      currentMode = 'draw';
      canvas.style.cursor = 'crosshair';
    }
  };
  document.getElementById('zoomResetModeRadio').onchange = function() {
    if (this.checked) {
      zoomLevel = 1;
      panX = 0;
      panY = 0;
      drawCanvasWithPreview();
      document.getElementById('drawModeRadio').checked = true;
      currentMode = 'draw';
      canvas.style.cursor = 'crosshair';
    }
  };
  // Set initial mode
  canvas.style.cursor = 'crosshair';

  // --- PAN LOGIC ---
  canvas.addEventListener('mousedown', function(e) {
    if (currentMode === 'pan' && e.button === 0) {
      isPanning = true;
      const rect = canvas.getBoundingClientRect();
      panStart = {
        x: e.clientX - rect.left - panX,
        y: e.clientY - rect.top - panY
      };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (currentMode !== 'draw') return;
    const {x: mx, y: my} = getMousePos(e);
    // Show zoomed area on every click
    if (isEditing && editBoxIdx !== null) {
      // Editing mode: check for handle or drag
      const box = boxes[editBoxIdx];
      const handleIdx = hitTestHandle(mx, my, box);
      if (handleIdx !== -1) {
        editDragMode = 'resize';
        editDragCorner = handleIdx;
        editDragOffset = { x: mx, y: my };
      } else if (hitTestBox(mx, my, box)) {
        editDragMode = 'move';
        editDragOffset = { x: mx - box.x, y: my - box.y };
      } else {
        editDragMode = null;
        editDragCorner = null;
      }
      return;
    }
    // Draw mode: start drawing new box
    startX = mx;
    startY = my;
    isDrawing = true;
    previewBox = null;
    selectedBoxIdx = null;
  });

  canvas.addEventListener('mousemove', function(e) {
    if (isPanning) {
      const rect = canvas.getBoundingClientRect();
      panX = (e.clientX - rect.left) - panStart.x;
      panY = (e.clientY - rect.top) - panStart.y;
      drawCanvasWithPreview();
      return;
    }
    if (currentMode !== 'draw') return;
    const {x: mx, y: my} = getMousePos(e);
    if (isEditing && editBoxIdx !== null && editDragMode) {
      let box = boxes[editBoxIdx];
      if (editDragMode === 'move') {
        box.x = mx - editDragOffset.x;
        box.y = my - editDragOffset.y;
        drawCanvasWithPreview();
      } else if (editDragMode === 'resize' && editDragCorner !== null) {
        let dx = mx - editDragOffset.x;
        let dy = my - editDragOffset.y;
        switch (editDragCorner) {
          case 0: box.x += dx; box.y += dy; box.w -= dx; box.h -= dy; break;
          case 1: box.y += dy; box.h -= dy; break;
          case 2: box.y += dy; box.w += dx; box.h -= dy; break;
          case 3: box.w += dx; break;
          case 4: box.w += dx; box.h += dy; break;
          case 5: box.h += dy; break;
          case 6: box.x += dx; box.w -= dx; box.h += dy; break;
          case 7: box.x += dx; box.w -= dx; break;
        }
        editDragOffset = { x: mx, y: my };
        drawCanvasWithPreview();
      }
      return;
    }
    if (isDrawing) {
      const currX = mx;
      const currY = my;
      previewBox = {
        x: Math.min(startX, currX),
        y: Math.min(startY, currY),
        w: Math.abs(currX - startX),
        h: Math.abs(currY - startY),
        label: labels[0] || ''
      };
      drawCanvasWithPreview(previewBox);
    }
  });

  canvas.addEventListener('mouseup', function(e) {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = 'grab';
      return;
    }
    if (currentMode !== 'draw') return;
    if (isEditing && editBoxIdx !== null && editDragMode) {
      editDragMode = null;
      editDragCorner = null;
      // Stay in edit mode for more drags/resizes
      return;
    }
    if (isDrawing) {
      isDrawing = false;
      if (previewBox && previewBox.w > 2 && previewBox.h > 2) {
        boxes.push(previewBox);
        selectedBoxIdx = null; // Do not highlight the new box
        renderLabels();
      }
      previewBox = null;
      drawCanvasWithPreview();
    }
  });

  canvas.addEventListener('dblclick', function(e) {
    const {x: mx, y: my} = getMousePos(e);
    // If already editing, double-click outside box to exit edit mode
    if (isEditing && editBoxIdx !== null) {
      if (!hitTestBox(mx, my, boxes[editBoxIdx])) {
        isEditing = false;
        editBoxIdx = null;
        selectedBoxIdx = null;
        drawCanvasWithPreview();
        renderLabels();
      }
      return;
    }
    // Find the topmost box under cursor to enter edit mode
    for (let i = boxes.length - 1; i >= 0; i--) {
      if (hitTestBox(mx, my, boxes[i])) {
        isEditing = true;
        editBoxIdx = i;
        selectedBoxIdx = i;
        drawCanvasWithPreview();
        renderLabels();
        return;
      }
    }
  });

  canvas.addEventListener('mouseleave', function(e) {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = 'grab';
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Show back button if navigated from review grid
  const params = new URLSearchParams(window.location.search);
  const backTo = params.get('back');
  if (backTo === 'review') {
    const backDiv = document.getElementById('backToReviewContainer');
    if (backDiv) {
      backDiv.style.display = '';
      const btn = document.getElementById('backToReviewBtn');
      if (btn) {
        btn.onclick = function() {
          // Make back button behave like browser back arrow
          if (window.history.length > 1) {
            window.history.back();
          } else {
            // Fallback: Go back to review grid (restore project, subset, and scroll to last image in review grid)
            const params = new URLSearchParams(window.location.search);
            const project = params.get('project') || getProjectName();
            const subset = params.get('subset') || '';
            let lastImage = params.get('reviewImg') || params.get('image') || '';
            if (!lastImage) {
              try {
                lastImage = localStorage.getItem('manual_annotate_selected_image') || '';
              } catch {}
            }
            let url = 'view_predictions.html';
            if (project) url += `?project=${encodeURIComponent(project)}`;
            if (subset) url += `${project ? '&' : '?'}subset=${encodeURIComponent(subset)}`;
            if (lastImage) url += `${project || subset ? '&' : '?'}scrollTo=${encodeURIComponent(lastImage)}`;
            url += `${project || subset || lastImage ? '&' : '?'}reviewGrid=1`;
            window.location.href = url;
          }
        };
      }
    }
  }

  projectName = getProjectName();
  document.getElementById('pageTitle').innerText = `Manual Annotation: ${projectName}`;
  // Helper to get image param from URL or localStorage
  function getInitialImageName() {
    const params = new URLSearchParams(window.location.search);
    let imgParam = params.get('image');
    if (imgParam) return imgParam;
    try {
      let stored = localStorage.getItem('manual_annotate_image');
      if (stored) return stored;
    } catch {}
    return null;
  }

  Promise.all([
    fetchImages(),
    fetchAnnotationMap()
  ]).then(([imgs, annoMap]) => {
    allImages = imgs;
    annotationMap = annoMap;
    updateImageLists();
    // Default to unannotated tab
    currentTab = 'unannotated';
    images = unannotatedImages;
    if (unannotatedImages.length === 0 && annotatedImages.length > 0) {
      currentTab = 'annotated';
      images = annotatedImages;
    }
    if (images.length === 0) {
      document.getElementById('imageList').innerHTML = '<div>No images to annotate.</div>';
      return;
    }

    // Try to select image from URL param or localStorage
    let initialImage = getInitialImageName();
    let idx = -1;
    if (initialImage) {
      // Check both tabs for the image
      let unIdx = unannotatedImages.indexOf(initialImage);
      let anIdx = annotatedImages.indexOf(initialImage);
      if (unIdx !== -1) {
        currentTab = 'unannotated';
        images = unannotatedImages;
        idx = unIdx;
      } else if (anIdx !== -1) {
        currentTab = 'annotated';
        images = annotatedImages;
        idx = anIdx;
      }
    }
    if (idx === -1) idx = 0;
    currentImageIdx = idx;
    renderImageList();
    setupCanvas();
    loadImage();
    setTimeout(drawCanvasWithPreview, 100);
  });

  document.getElementById('addLabelBtn').onclick = function() {
    const newLabel = document.getElementById('newLabelInput').value.trim();
    if (newLabel && !labels.includes(newLabel)) {
      labels.push(newLabel);
      renderLabels();
      document.getElementById('newLabelInput').value = '';
    }
  };

  renderModeSelector();
  renderModeActionSection();
});

document.addEventListener('keydown', function(e) {
  // Only trigger if focus is not in an input or textarea
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
  if (e.key === 'ArrowLeft') {
    if (currentImageIdx > 0) {
      currentImageIdx--;
      loadImage();
      // Update selection highlight for all thumbnails
      document.querySelectorAll('.anno-img-thumb').forEach(el => el.classList.remove('selected'));
      const thumb = document.querySelector('.anno-img-thumb[data-idx="' + currentImageIdx + '"]');
      if (thumb) thumb.classList.add('selected');
    }
  } else if (e.key === 'ArrowRight') {
    if (currentImageIdx < images.length - 1) {
      currentImageIdx++;
      loadImage();
      document.querySelectorAll('.anno-img-thumb').forEach(el => el.classList.remove('selected'));
      const thumb = document.querySelector('.anno-img-thumb[data-idx="' + currentImageIdx + '"]');
      if (thumb) thumb.classList.add('selected');
    }
  }
});

function drawCanvasWithPreview(previewBox = null) {
  const imgName = images[currentImageIdx];
  const canvas = document.getElementById('annotateCanvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = function() {
    // Dynamically set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Apply pan and zoom
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoomLevel, zoomLevel);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    // Draw all existing boxes
    boxes.forEach((box, idx) => {
      ctx.save();
      ctx.strokeStyle = idx === selectedBoxIdx ? "#f63366" : "#1976d2";
      ctx.lineWidth = idx === selectedBoxIdx ? 3/zoomLevel : 2/zoomLevel;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `${14/zoomLevel}px Arial`;
      ctx.fillText(box.label, box.x + 2, box.y + 16/zoomLevel);
      if (idx === selectedBoxIdx) {
        drawHandles(ctx, box);
      }
      ctx.restore();
    });
    // Draw preview box if present
    if (previewBox) {
      ctx.save();
      ctx.strokeStyle = "#f63366";
      ctx.lineWidth = 2/zoomLevel;
      ctx.setLineDash([6/zoomLevel, 4/zoomLevel]);
      ctx.strokeRect(previewBox.x, previewBox.y, previewBox.w, previewBox.h);
      ctx.restore();
    }
    ctx.restore();
  };
  img.src = `/projects/${encodeURIComponent(projectName)}/images/${encodeURIComponent(imgName)}`;
}
