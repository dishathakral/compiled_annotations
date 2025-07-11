// review_annotated_images.js
// Show all manually annotated images in a grid with thumbnail, filename, and View/Edit button

async function fetchAnnotatedImages(projectName) {
  const resp = await fetch(`/projects/${encodeURIComponent(projectName)}/manual_annotations.json`);
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!data.images) return [];
  return Object.keys(data.images);
}

function renderAnnotatedImageGrid(projectName, imageList, containerId, onViewEdit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!imageList.length) {
    container.innerHTML = '<div style="color:#f63366;">No manually annotated images found.</div>';
    return;
  }
  // Get current subset from URL if present
  const params = new URLSearchParams(window.location.search);
  const subset = params.get('subset') || '';
  const grid = document.createElement('div');
  grid.style.display = 'flex';
  grid.style.flexWrap = 'wrap';
  grid.style.gap = '18px';
  grid.style.maxHeight = '60vh';
  grid.style.overflowY = 'auto';
  imageList.forEach(img => {
    const card = document.createElement('div');
    card.style.width = '120px';
    card.style.background = '#fafbfc';
    card.style.border = '1px solid #ddd';
    card.style.borderRadius = '8px';
    card.style.padding = '8px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.alignItems = 'center';
    card.style.boxShadow = '0 1px 4px #0001';
    const thumb = document.createElement('img');
    thumb.src = `/projects/${encodeURIComponent(projectName)}/images/${encodeURIComponent(img)}`;
    thumb.alt = img;
    thumb.style.width = '100px';
    thumb.style.height = '100px';
    thumb.style.objectFit = 'cover';
    thumb.style.borderRadius = '4px';
    thumb.style.marginBottom = '8px';
    const fname = document.createElement('div');
    fname.textContent = img;
    fname.style.fontSize = '12px';
    fname.style.wordBreak = 'break-all';
    fname.style.marginBottom = '6px';
    fname.style.textAlign = 'center';
    const btn = document.createElement('button');
    btn.textContent = 'View/Edit';
    btn.className = 'anno-btn btn btn-primary';
    btn.style.fontSize = '0.98em';
    btn.style.padding = '4px 10px';
    btn.onclick = () => {
      // If already on manual annotation page, trigger image selection
      if (window.location.pathname.includes('manual_annotate.html')) {
        if (window.setCurrentImageByName) {
          window.setCurrentImageByName(img);
        } else {
          window.localStorage.setItem('manual_annotate_selected_image', img);
          window.location.reload();
        }
      } else {
        // Always use ?name= for project, for compatibility with getProjectName()
        // Add &back=review, &project, &subset, &reviewGrid=1, &reviewImg=... to enable back button with context
        let url = `manual_annotate.html?name=${encodeURIComponent(projectName)}&image=${encodeURIComponent(img)}&back=review`;
        if (projectName) url += `&project=${encodeURIComponent(projectName)}`;
        if (subset) url += `&subset=${encodeURIComponent(subset)}`;
        // Add reviewGrid=1 and reviewImg=img to signal grid context
        url += `&reviewGrid=1&reviewImg=${encodeURIComponent(img)}`;
        window.location.href = url;
      }
      if (typeof onViewEdit === 'function') onViewEdit(img);
    };

    // Bin (delete) button
    const binBtn = document.createElement('button');
    binBtn.innerHTML = '🗑️';
    binBtn.title = 'Remove this image from training';
    binBtn.className = 'anno-btn btn btn-danger';
    binBtn.style.fontSize = '1.1em';
    binBtn.style.padding = '2px 8px';
    binBtn.style.marginTop = '4px';
    binBtn.onclick = (e) => {
      e.stopPropagation();
      if (!confirm(`Remove image "${img}" from training?`)) return;
      // Remove from UI immediately
      card.remove();
      // Call backend to remove from manual_annotations.json
      fetch(`/api/projects/${encodeURIComponent(projectName)}/remove_annotated_image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: img })
      }).then(res => res.json()).then(data => {
        if (!data.success) {
          alert(data.error || 'Failed to remove image from training.');
        }
      });
      if (typeof onViewEdit === 'function') onViewEdit(img, {delete:true});
    };

    card.appendChild(thumb);
    card.appendChild(fname);
    card.appendChild(btn);
    card.appendChild(binBtn);
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// Usage example (to be called from view_predictions.js or custom training modal):
// fetchAnnotatedImages(projectName).then(imgs => renderAnnotatedImageGrid(projectName, imgs, 'annotatedImageGrid', onViewEdit));
// function onViewEdit(imgName) { ... }
