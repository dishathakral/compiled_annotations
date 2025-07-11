// Full code from frontend/auto_annotate_dataset.js
// Constant for the backend URL

// ...existing code from frontend/auto_annotate_dataset.js (see previous read_file results)...
// (Full code inserted here, see previous read_file results)

// ...rest of the code remains unchanged...
// Constant for the backend URL
const BACKEND_URL = window.location.origin;


// Function to show status messages to the user
function showAutoAnnotateStatus(message, isError = false) {
    let statusDiv = document.getElementById('autoAnnotateStatus');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'autoAnnotateStatus';
        document.body.appendChild(statusDiv);
    }
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? 'red' : 'green';
}

// Function to send auto-annotate request for the complete dataset
// Only process unannotated images for complete dataset auto-annotation
function requestAutoAnnotateDataset(projectName, userOptions = {}) {
    showAutoAnnotateStatus('Submitting auto-annotate request...');
    Promise.all([
        fetch(`${BACKEND_URL}/api/projects/${projectName}/images`).then(r => r.json()),
        fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`).then(r => r.ok ? r.json() : { images: {} })
    ]).then(([images, annotations]) => {
        const annotatedSet = new Set(Object.keys((annotations && annotations.images) || {}));
        const unannotated = images.filter(img => !annotatedSet.has(img));
        fetch(`${BACKEND_URL}/api/projects/${projectName}/auto_annotate_request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...userOptions, images: unannotated })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showAutoAnnotateStatus('Auto-annotate request saved!');
            } else {
                showAutoAnnotateStatus('Error: ' + (data.error || 'Unknown error'), true);
            }
        })
        .catch(error => {
            showAutoAnnotateStatus('Request failed: ' + error, true);
        });
    }).catch(error => {
        showAutoAnnotateStatus('Failed to load images: ' + error, true);
    });
}

// Fetch and display the list of images for the current project
function fetchAndDisplayImageList(projectName) {
    fetch(`${BACKEND_URL}/api/projects/${projectName}/images`)
        .then(response => response.json())
        .then(images => {
            const resultDiv = document.getElementById('result');
            if (!Array.isArray(images) || images.length === 0) {
                resultDiv.textContent = 'No images found.';
                return;
            }
            resultDiv.innerHTML = '<h3>Images in Project:</h3>' +
                '<ul>' + images.map(img => `<li>${img}</li>`).join('') + '</ul>';
        })
        .catch(error => {
            const resultDiv = document.getElementById('result');
            resultDiv.textContent = 'Failed to load images: ' + error;
        });
}

// Show subset details and allow selection
function showSubsetOptions(projectName, subsetJson) {
    const resultDiv = document.getElementById('result');
    // Fetch and display the subset's images, filtering out annotated ones
    Promise.all([
        fetch(`${BACKEND_URL}/projects/${projectName}/${subsetJson}`).then(r => r.json()),
        fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`).then(r => r.ok ? r.json() : { images: {} })
    ]).then(([data, annotations]) => {
        const annotatedSet = new Set(Object.keys((annotations && annotations.images) || {}));
        const images = (data.images || []).filter(img => !annotatedSet.has(img));
        let html = `<h3>Subset: ${subsetJson}</h3>`;
        html += `<div><b>Unannotated images in this subset (${images.length}):</b></div>`;
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin:10px 0;">' +
            images.map(img => {
                const imgUrl = `${BACKEND_URL}/projects/${projectName}/images/${encodeURIComponent(img)}`;
                return `<div style='display:inline-block;text-align:center;'>\
                    <img src='${imgUrl}' alt='${img}' style='width:80px;height:80px;object-fit:cover;display:block;margin-bottom:4px;border:1px solid #ccc;'>\
                    <span style='font-size:12px;word-break:break-all;'>${img}</span>\
                </div>`;
            }).join('') + '</div>';
        html += `<button id="selectSubsetBtn">Select This Subset</button> `;
        html += `<button id="backToSubsetsBtn">Back to Subsets</button>`;
        resultDiv.innerHTML = html;
        document.getElementById('selectSubsetBtn').onclick = function() {
            // Store selected subset in localStorage
            localStorage.setItem(`selectedSubset_${projectName}`, subsetJson);
            showAutoAnnotateStatus(`Subset selected: ${subsetJson}`);
        };
        document.getElementById('backToSubsetsBtn').onclick = function() {
            fetchAndDisplaySubsets(projectName);
        };
    }).catch(error => {
        resultDiv.innerHTML = 'Failed to load subset: ' + error;
    });
}

// Fetch and display available subsets for the project
function fetchAndDisplaySubsets(projectName) {
    fetch(`${BACKEND_URL}/api/projects/${projectName}/subsets`)
        .then(response => response.json())
        .then(subsets => {
            const resultDiv = document.getElementById('result');
            if (!Array.isArray(subsets) || subsets.length === 0) {
                resultDiv.innerHTML = '<h3>No subsets found.</h3>';
                return;
            }
            resultDiv.innerHTML = '<h3>Available Subsets:</h3>' +
                '<ul>' + subsets.map(sub =>
                    `<li style="display:flex;align-items:center;gap:8px;">
                        <button class="choose-subset-btn" data-json="${sub.json}">${sub.name}</button>
                        <button class="delete-subset-btn" data-name="${sub.name}" title="Delete subset" style="color:red;background:none;border:none;cursor:pointer;font-size:18px;">🗑️</button>
                    </li>`
                ).join('') + '</ul>';
            // Add event listeners for subset selection
            document.querySelectorAll('.choose-subset-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const subsetJson = btn.getAttribute('data-json');
                    showSubsetOptions(projectName, subsetJson);
                });
            });
            // Add event listeners for subset deletion
            document.querySelectorAll('.delete-subset-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const subsetName = btn.getAttribute('data-name');
                    if (confirm(`Delete subset ${subsetName}? This cannot be undone.`)) {
                        fetch(`${BACKEND_URL}/api/projects/${projectName}/delete_subset`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subset_name: subsetName })
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.message) {
                                showAutoAnnotateStatus(data.message);
                                fetchAndDisplaySubsets(projectName);
                            } else {
                                showAutoAnnotateStatus('Error: ' + (data.error || 'Unknown error'), true);
                            }
                        })
                        .catch(error => {
                            showAutoAnnotateStatus('Delete failed: ' + error, true);
                        });
                    }
                });
            });
        })
        .catch(error => {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Failed to load subsets: ' + error;
        });
}

// Utility function to get the current project name
function getCurrentProjectName() {
    // Try to get from localStorage (recommended for SPA)
    let name = localStorage.getItem('currentProjectName');
    if (name) return name;
    // Try to get from URL query string (?name=foo or ?project=foo)
    const params = new URLSearchParams(window.location.search);
    name = params.get('name');
    if (name) return name;
    name = params.get('project');
    if (name) return name;
    // Try to get from a hidden input (if present in HTML)
    const input = document.getElementById('projectNameInput');
    if (input && input.value) return input.value;
    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    const completeBtn = document.getElementById('complete-btn');
    const manualBtn = document.getElementById('manual-btn');
    const manualSection = document.getElementById('manual-section');
    const manualForm = document.getElementById('manual-form');
    const manualSubmit = document.getElementById('manual-submit');
    const randomBtn = document.getElementById('random-btn');
    const randomSection = document.getElementById('random-section');
    const randomPercent = document.getElementById('random-percent');
    const randomSubmit = document.getElementById('random-submit');
    const projectName = getCurrentProjectName && getCurrentProjectName();

    function hideAllSections() {
        manualSection.style.display = 'none';
        randomSection.style.display = 'none';
        manualForm.innerHTML = '';
    }

    if (completeBtn) {
        completeBtn.addEventListener('click', function() {
            if (!projectName) {
                showAutoAnnotateStatus('Project name not found. Please select a project.', true);
                return;
            }
            showAutoAnnotateStatus('Submitting auto-annotate request...');
            fetch(`${BACKEND_URL}/api/projects/${projectName}/auto_annotate_request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    showAutoAnnotateStatus(data.message);
                } else {
                    showAutoAnnotateStatus('Error: ' + (data.error || 'Unknown error'), true);
                }
            })
            .catch(error => {
                showAutoAnnotateStatus('Request failed: ' + error, true);
            });
        });
    }
    if (manualBtn) {
        let manualActive = false;
        manualBtn.addEventListener('click', function() {
            if (!manualActive) {
                hideAllSections();
                manualSection.style.display = 'block';
                manualActive = true;
                if (!projectName) {
                    showAutoAnnotateStatus('Project name not found. Please select a project.', true);
                    return;
                }
                // Fetch images and manual_annotations.json, then filter out annotated images
                Promise.all([
                    fetch(`${BACKEND_URL}/api/projects/${projectName}/images`).then(r => r.json()),
                    fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`).then(r => r.ok ? r.json() : { images: {} })
                ]).then(([images, annotations]) => {
                    if (!Array.isArray(images) || images.length === 0) {
                        manualForm.innerHTML = 'No images found.';
                        return;
                    }
                    const annotatedSet = new Set(Object.keys((annotations && annotations.images) || {}));
                    const unannotated = images.filter(img => !annotatedSet.has(img));
                    if (unannotated.length === 0) {
                        manualForm.innerHTML = 'No unannotated images found.';
                        return;
                    }
                    const info = `<div style='margin-bottom:10px;font-weight:bold;'>Unannotated images: ${unannotated.length}</div>`;
                    manualForm.innerHTML = info + unannotated.map(img => {
                        const imgUrl = `${BACKEND_URL}/projects/${projectName}/images/${encodeURIComponent(img)}`;
                        return `<label style='display:inline-block;margin:8px;text-align:center;'>\
                            <input type='checkbox' name='images' value='${img}'>\
                            <img src='${imgUrl}' alt='${img}' style='width:80px;height:80px;object-fit:cover;display:block;margin-bottom:4px;border:1px solid #ccc;'>\
                            <span style='font-size:12px;word-break:break-all;'>${img}</span>\
                        </label>`;
                    }).join('');
                }).catch(error => {
                    manualForm.innerHTML = 'Failed to load images: ' + error;
                });
            } else {
                // Second click: remove manual selection UI
                hideAllSections();
                manualActive = false;
            }
        });
    }

    if (manualSubmit) {
        manualSubmit.addEventListener('click', function(e) {
            e.preventDefault();
            if (!projectName) {
                showAutoAnnotateStatus('Project name not found. Please select a project.', true);
                return;
            }
            const checked = Array.from(manualForm.querySelectorAll('input[name="images"]:checked')).map(cb => cb.value);
            if (checked.length === 0) {
                showAutoAnnotateStatus('Please select at least one image.', true);
                return;
            }
            fetch(`${BACKEND_URL}/api/projects/${projectName}/create_manual_subset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: checked })
            })
            .then(response => response.json())
            .then(function(data) {
                if (data.message) {
                    showAutoAnnotateStatus(data.message);
                    fetchAndDisplaySubsets(projectName);
                    hideAllSections();
                } else {
                    showAutoAnnotateStatus('Error: ' + (data.error || 'Unknown error'), true);
                }
            })
            .catch(function(error) {
                showAutoAnnotateStatus('Request failed: ' + error, true);
            });
        });
    }

    if (randomBtn) {
        let randomActive = false;
        randomBtn.addEventListener('click', function() {
            if (!randomActive) {
                hideAllSections();
                randomSection.style.display = 'block';
                randomActive = true;
            } else {
                hideAllSections();
                randomActive = false;
            }
        });
    }

    if (randomSubmit) {
        randomSubmit.addEventListener('click', function(e) {
            e.preventDefault();
            if (!projectName) {
                showAutoAnnotateStatus('Project name not found. Please select a project.', true);
                return;
            }
            const percent = parseFloat(randomPercent.value);
            if (isNaN(percent) || percent <= 0 || percent > 100) {
                showAutoAnnotateStatus('Please enter a valid percentage (1-100).', true);
                return;
            }
            fetch(`${BACKEND_URL}/api/projects/${projectName}/create_random_subset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ percent })
            })
            .then(response => response.json())
            .then(function(data) {
                if (data.message) {
                    showAutoAnnotateStatus(data.message);
                    fetchAndDisplaySubsets(projectName);
                    hideAllSections();
                } else {
                    showAutoAnnotateStatus('Error: ' + (data.error || 'Unknown error'), true);
                }
            })
            .catch(function(error) {
                showAutoAnnotateStatus('Request failed: ' + error, true);
            });
        });
    }

    // --- Model selection logic for sidebar ---
    const modelFamilySel = document.getElementById('modelFamily');
    const modelVersionSel = document.getElementById('modelVersion');
    const modelDescDiv = document.getElementById('modelDescription');
    const modelSelectStatus = document.getElementById('modelSelectStatus');

    async function fetchModelList() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/models/list`);
        return await res.json();
      } catch (e) {
        showAutoAnnotateStatus('Failed to fetch model list from backend.', true);
        return {};
      }
    }
    async function fetchModelDescriptions() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/models/descriptions`);
        return await res.json();
      } catch (e) {
        return {};
      }
    }

    async function setupModelSelection() {
      let modelList = await fetchModelList();
      let modelDescriptions = await fetchModelDescriptions();
      if (!modelFamilySel || !modelVersionSel) return;
      if (!modelList || Object.keys(modelList).length === 0) {
        modelFamilySel.innerHTML = '<option value="">No models found</option>';
        modelVersionSel.innerHTML = '<option value="">Select version</option>';
        return;
      }
      modelFamilySel.innerHTML = '<option value="">Select family</option>' +
        Object.keys(modelList).map(fam => `<option value="${fam}">${fam}</option>`).join('');
      modelFamilySel.onchange = function() {
        const fam = modelFamilySel.value;
        modelVersionSel.innerHTML = '<option value="">Select version</option>';
        modelDescDiv.textContent = '';
        modelSelectStatus.textContent = '';
        if (fam && modelList[fam]) {
          modelVersionSel.innerHTML += modelList[fam].map(ver => `<option value="${ver}">${ver}</option>`).join('');
        }
      };
      modelVersionSel.onchange = function() {
        const fam = modelFamilySel.value;
        const ver = modelVersionSel.value;
        if (fam && ver && modelDescriptions[fam] && modelDescriptions[fam][ver]) {
          modelDescDiv.textContent = modelDescriptions[fam][ver];
          modelSelectStatus.textContent = `Selected: ${fam} / ${ver}`;
        } else {
          modelDescDiv.textContent = '';
          modelSelectStatus.textContent = '';
        }
      };
    }

    setupModelSelection();

    // Always show available subsets
    if (projectName) {
        fetchAndDisplaySubsets(projectName);
    }

    // --- Modal logic for auto-annotate feedback and next steps ---
    function showAutoAnnotateModal(contentHtml) {
        const modal = document.getElementById('autoAnnotateModal');
        const modalContent = document.getElementById('autoAnnotateModalContent');
        modalContent.innerHTML = contentHtml;
        modal.style.display = 'flex';
    }
    function closeAutoAnnotateModal() {
        document.getElementById('autoAnnotateModal').style.display = 'none';
    }
    const closeModalBtn = document.getElementById('closeAutoAnnotateModal');
    if (closeModalBtn) closeModalBtn.onclick = closeAutoAnnotateModal;
    window.onclick = function(event) {
        const modal = document.getElementById('autoAnnotateModal');
        if (event.target === modal) closeAutoAnnotateModal();
    };

    // --- Start Auto-Annotate button logic ---
    const startAutoAnnotateBtn = document.getElementById('startAutoAnnotateBtn');
    if (startAutoAnnotateBtn) {
        startAutoAnnotateBtn.addEventListener('click', function() {
            const selectedModelFamily = modelFamilySel.value;
            const selectedModelVersion = modelVersionSel.value;
            if (!selectedModelFamily || !selectedModelVersion) {
                showAutoAnnotateStatus('Please select both model family and version.', true);
                return;
            }
            // Here you would typically send a request to start the auto-annotation process
            showAutoAnnotateStatus(`Auto-annotation started with model ${selectedModelFamily} / ${selectedModelVersion}`);
        });
    }

    // --- Auto Label With This Model button logic ---
    const autoLabelBtn = document.getElementById('start-auto-annotate-btn');
    if (autoLabelBtn) {
        autoLabelBtn.addEventListener('click', async function() {
            const modelFamilySel = document.getElementById('modelFamily');
            const modelVersionSel = document.getElementById('modelVersion');
            const projectName = getCurrentProjectName();
            const selectedModelFamily = modelFamilySel.value;
            const selectedModelVersion = modelVersionSel.value;
            if (!selectedModelFamily || !selectedModelVersion) {
                showAutoAnnotateStatus('Please select both model family and version.', true);
                return;
            }
            // Get selected subset from localStorage (or fallback to first subset)
            let selectedSubset = localStorage.getItem(`selectedSubset_${projectName}`);
            let numImages = 0;
            let subsetName = '';
            let unannotatedImages = [];
            if (selectedSubset) {
                subsetName = selectedSubset;
                // Fetch subset json and manual_annotations.json to get unannotated image count
                try {
                    const [resp, annResp] = await Promise.all([
                        fetch(`${BACKEND_URL}/projects/${projectName}/${selectedSubset}`),
                        fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`)
                    ]);
                    const data = await resp.json();
                    const annotations = annResp.ok ? await annResp.json() : { images: {} };
                    const annotatedSet = new Set(Object.keys((annotations && annotations.images) || {}));
                    unannotatedImages = (data.images || []).filter(img => !annotatedSet.has(img));
                    numImages = unannotatedImages.length;
                } catch (e) { numImages = 0; }
            } else {
                // Try to get first available subset
                try {
                    const resp = await fetch(`${BACKEND_URL}/api/projects/${projectName}/subsets`);
                    const subsets = await resp.json();
                    if (subsets.length > 0) {
                        subsetName = subsets[0].json;
                        const [resp2, annResp2] = await Promise.all([
                            fetch(`${BACKEND_URL}/projects/${projectName}/${subsetName}`),
                            fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`)
                        ]);
                        const data2 = await resp2.json();
                        const annotations2 = annResp2.ok ? await annResp2.json() : { images: {} };
                        const annotatedSet2 = new Set(Object.keys((annotations2 && annotations2.images) || {}));
                        unannotatedImages = (data2.images || []).filter(img => !annotatedSet2.has(img));
                        numImages = unannotatedImages.length;
                    }
                } catch (e) { numImages = 0; }
            }
            // Show modal with info and Start button
            let html = `<h2>Auto Label With This Model</h2>`;
            html += `<div><b>Model Family:</b> ${selectedModelFamily}</div>`;
            html += `<div><b>Model Version:</b> ${selectedModelVersion}</div>`;
            html += `<div><b>Subset:</b> ${subsetName ? subsetName : 'None selected'}</div>`;
            html += `<div><b>Number of Images:</b> ${numImages}</div>`;
            if (!subsetName) {
                html += `<div style='color:red;margin-top:10px;'>No subset selected or available.</div>`;
            } else {
                html += `<button id='confirmStartAutoLabelBtn' class='primary-btn' style='margin-top:18px;'>Start Auto Label</button>`;
            }
            showAutoAnnotateModal(html);
            // Add event for confirm button
            setTimeout(() => {
                const confirmBtn = document.getElementById('confirmStartAutoLabelBtn');
                if (confirmBtn) {
                    confirmBtn.onclick = async function() {
                        // Send config to backend (save_auto_annotate_config)
                        showAutoAnnotateStatus('Starting auto-labeling...');
                        try {
                            const resp = await fetch(`${BACKEND_URL}/api/projects/${projectName}/save_auto_annotate_config`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model_family: selectedModelFamily,
                                    model_version: selectedModelVersion,
                                    subset: subsetName
                                })
                            });
                            const data = await resp.json();
                            if (data.message) {
                                // After config is saved, trigger inference
                                showAutoAnnotateStatus('Auto-labeling started! Running inference...');
                                try {
                                    const inferResp = await fetch(`${BACKEND_URL}/api/projects/${projectName}/run_auto_label`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' }
                                    });
                                    const inferData = await inferResp.json();
                                    if (inferData.message) {
                                        showAutoAnnotateStatus('Inference complete! ' + inferData.message);
                                        // Add View Predictions button
                                        const statusDiv = document.getElementById('autoAnnotateStatus');
                                        if (statusDiv) {
                                            const viewBtn = document.createElement('button');
                                            viewBtn.textContent = 'View Predictions';
                                            viewBtn.style.marginLeft = '12px';
                                            viewBtn.onclick = function() {
                                                // Open the new predictions viewer page with project and subset as params (same tab)
                                                window.location.href = `view_predictions.html?project=${encodeURIComponent(projectName)}&subset=${encodeURIComponent(subsetName)}`;
                                            };
                                            statusDiv.appendChild(viewBtn);
                                        }
                                    } else if (inferData.error) {
                                        showAutoAnnotateStatus('Inference error: ' + inferData.error, true);
                                    } else {
                                        showAutoAnnotateStatus('Unknown error occurred during inference.', true);
                                    }
                                } catch (e) {
                                    showAutoAnnotateStatus('Inference request failed: ' + e, true);
                                }
                                closeAutoAnnotateModal();
                            } else if (data.error) {
                                showAutoAnnotateStatus('Error: ' + data.error, true);
                            } else {
                                showAutoAnnotateStatus('Unknown error occurred while saving config.', true);
                            }
                        } catch (e) {
                            showAutoAnnotateStatus('Request failed: ' + e, true);
                        }
                    };
                }
            }, 100);
        });
    }

    // When rendering subset images, always use the #subset-images container
});

// New code to fetch model families and versions
document.addEventListener('DOMContentLoaded', async function() {
    const modelFamilySel = document.getElementById('modelFamily');
    const modelVersionSel = document.getElementById('modelVersion');

    async function fetchModelFamilies() {
        const res = await fetch(`${BACKEND_URL}/api/models/families`);
        return await res.json();
    }


    async function fetchModelVersions(family, project) {
        let url = `${BACKEND_URL}/api/models/versions?family=${encodeURIComponent(family)}`;
        if (project) url += `&project=${encodeURIComponent(project)}`;
        const res = await fetch(url);
        return await res.json();
    }

    // Populate model families
    const families = await fetchModelFamilies();
    modelFamilySel.innerHTML = '<option value="">Select family</option>' +
        families.map(fam => `<option value="${fam}">${fam}</option>`).join('');

    modelFamilySel.onchange = async function() {
        const fam = modelFamilySel.value;
        modelVersionSel.innerHTML = '<option value="">Select version</option>';
        if (fam) {
            const versions = await fetchModelVersions(fam, projectName);
            modelVersionSel.innerHTML += versions.map(ver => `<option value="${ver}">${ver}</option>`).join('');
        }
    };
});

// Add select/deselect all for subset images
function setupSubsetSelectButtons() {
    const selectAllBtn = document.getElementById('select-all-subset');
    const deselectAllBtn = document.getElementById('deselect-all-subset');
    const subsetImagesDiv = document.getElementById('subset-images');
    if (selectAllBtn && deselectAllBtn && subsetImagesDiv) {
        selectAllBtn.onclick = function() {
            const checkboxes = subsetImagesDiv.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => { cb.checked = true; });
        };
        deselectAllBtn.onclick = function() {
            const checkboxes = subsetImagesDiv.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => { cb.checked = false; });
        };
    }
}

// Call this after rendering subset images
const observer = new MutationObserver(() => {
    setupSubsetSelectButtons();
});
observer.observe(document.body, { childList: true, subtree: true });

// Patch subset image rendering to use checkboxes and allow select/deselect all
// Only show unannotated images in subset image selection
function renderSubsetImages(images, projectName) {
    const subsetImagesDiv = document.getElementById('subset-images');
    if (!subsetImagesDiv) return;
    // Fetch manual_annotations.json to filter out annotated images
    fetch(`${BACKEND_URL}/projects/${projectName}/manual_annotations.json`).then(r => r.ok ? r.json() : { images: {} }).then(annotations => {
        const annotatedSet = new Set(Object.keys((annotations && annotations.images) || {}));
        const unannotated = images.filter(img => !annotatedSet.has(img));
        subsetImagesDiv.innerHTML = unannotated.map(img => {
            const imgUrl = `${BACKEND_URL}/projects/${projectName}/images/${encodeURIComponent(img)}`;
            return `<label style='display:inline-block;margin:8px;text-align:center;'>
                <input type='checkbox' name='subset-images' value='${img}'>
                <img src='${imgUrl}' alt='${img}' style='width:80px;height:80px;object-fit:cover;display:block;margin-bottom:4px;border:1px solid #ccc;'>
                <span style='font-size:12px;word-break:break-all;'>${img}</span>
            </label>`;
        }).join('');
    });
}

// Patch: When subset-section is shown, render checkboxes for all images
const subsetSection = document.getElementById('subset-section');
if (subsetSection) {
    const observer = new MutationObserver(() => {
        if (subsetSection.style.display !== 'none') {
            // Try to get images from a global or fetch if needed
            // For demo, try to get from window.lastSubsetImages
            if (window.lastSubsetImages && window.lastSubsetProjectName) {
                renderSubsetImages(window.lastSubsetImages, window.lastSubsetProjectName);
            }
        }
    });
    observer.observe(subsetSection, { attributes: true, attributeFilter: ['style'] });
}

// When you fetch and display subset images, also set window.lastSubsetImages and window.lastSubsetProjectName
// Example: window.lastSubsetImages = images; window.lastSubsetProjectName = projectName;
// You may need to patch your subset fetch logic to do this.
