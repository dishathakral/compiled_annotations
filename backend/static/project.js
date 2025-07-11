/* Copied from frontend/project.js */
// project.js
// Handles project-specific page: upload, metadata, annotation options

function getProjectName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('name');
}

function fetchImageList(projectName) {
  return fetch(`/projects/${encodeURIComponent(projectName)}/images/`)
    .then(res => res.json())
    .catch(() => []);
}

function showMetaInfo(projectName) {
  fetchImageList(projectName).then(files => {
    const metaDiv = document.getElementById('metaInfo');
    const folderPath = `backend/projects/${projectName}/images`;
    if (files.length > 0) {
      metaDiv.innerHTML = `Number of images: ${files.length}<br>
        <span>Images folder: <code>${folderPath}</code></span>
        <button id='copyPathBtn'>Copy Path</button>`;
      document.getElementById('copyPathBtn').onclick = function() {
        navigator.clipboard.writeText(folderPath);
      };
    } else {
      metaDiv.innerText = 'No images uploaded yet.';
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const projectName = getProjectName();
  document.getElementById('projectTitle').innerText = `Project: ${projectName}`;

  fetchImageList(projectName).then(files => {
    const uploadSection = document.getElementById('uploadSection');
    if (files.length > 0) {
      // Hide upload if images exist, show only load new dataset option
      uploadSection.innerHTML = `
        <h2>Step 1: Data Already Uploaded</h2>
        <div style='color:green;'>Images already uploaded for this project.</div>
        <button id="loadNewBtn">Load Another Dataset</button>
        <div id="loadMsg"></div>
        <input type="file" id="zipInput" accept=".zip" style="display:none;" />
      `;
      document.getElementById('loadNewBtn').onclick = function() {
        document.getElementById('zipInput').style.display = '';
        document.getElementById('zipInput').onchange = function() {
          const zipInput = this;
          const msgDiv = document.getElementById('loadMsg');
          if (!zipInput.files.length) {
            msgDiv.innerText = 'Please select a zip file.';
            return;
          }
          const formData = new FormData();
          formData.append('file', zipInput.files[0]);
          fetch(`/api/projects/${encodeURIComponent(projectName)}/upload`, {
            method: 'POST',
            body: formData
          })
          .then(res => res.json())
          .then(data => {
            msgDiv.innerText = data.message || data.error;
            showMetaInfo(projectName);
          })
          .catch(() => {
            msgDiv.innerText = 'Upload failed.';
          });
        };
        document.getElementById('zipInput').click();
      };
    } else {
      // Show upload option if no images
      uploadSection.innerHTML = `
        <h2>Step 1: Import Data (Upload Folder as .zip)</h2>
        <input type="file" id="zipInput" accept=".zip" />
        <button id="uploadBtn">Upload</button>
        <div id="uploadMsg"></div>
      `;
      document.getElementById('uploadBtn').onclick = function() {
        const zipInput = document.getElementById('zipInput');
        const msgDiv = document.getElementById('uploadMsg');
        if (!zipInput.files.length) {
          msgDiv.innerText = 'Please select a zip file.';
          return;
        }
        const formData = new FormData();
        formData.append('file', zipInput.files[0]);
        fetch(`/api/projects/${encodeURIComponent(projectName)}/upload`, {
          method: 'POST',
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          msgDiv.innerText = data.message || data.error;
          showMetaInfo(projectName);
        })
        .catch(() => {
          msgDiv.innerText = 'Upload failed.';
        });
      };
    }
    showMetaInfo(projectName);
  });

  // Manual annotation button (existing logic)
  document.getElementById('manualBtn').onclick = function() {
    window.location.href = `manual_annotate.html?name=${encodeURIComponent(projectName)}`;
  };

  // Automatic annotation button: go directly to auto_annotate_dataset.html
  document.getElementById('autoBtn').onclick = function() {
    window.location.href = `auto_annotate_dataset.html?name=${encodeURIComponent(projectName)}`;
  };
});
