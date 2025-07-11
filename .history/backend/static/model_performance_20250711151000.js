// model_performance.js
// Fetches model performance metrics from backend and updates the HTML page dynamically

document.addEventListener('DOMContentLoaded', function() {
  // Get project name from URL (assumes /projects/<project>/model_performance)
  const pathParts = window.location.pathname.split('/');
  let project = '';
  if (pathParts.length > 2 && pathParts[1] === 'projects') {
    project = pathParts[2];
  }
  if (!project) return;

  fetch(`/api/projects/${encodeURIComponent(project)}/model_performance_json`)
    .then(resp => resp.json())
    .then(data => {
      // Update summary table
      document.getElementById('mp-epoch').textContent = data.last_epoch;
      document.getElementById('mp-train-loss').textContent = data.last_train_loss;
      document.getElementById('mp-val-loss').textContent = data.last_val_loss;
      document.getElementById('mp-map50').textContent = data.last_map_50;
      document.getElementById('mp-map5095').textContent = data.last_map_5095;
      document.getElementById('mp-precision').textContent = data.last_precision;
      document.getElementById('mp-recall').textContent = data.last_recall;
      // Render charts if Chart.js is loaded
      if (window.Chart) {
        new Chart(document.getElementById('lossChart'), {
          type: 'line',
          data: {
            labels: data.epochs,
            datasets: [
              { label: 'Train Loss', data: data.train_loss, borderColor: '#222', backgroundColor: 'rgba(34,34,34,0.1)', fill: false },
              { label: 'Val Loss', data: data.val_loss, borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.1)', fill: false }
            ]
          },
          options: {responsive:true, plugins:{legend:{position:'top'}}}
        });
        new Chart(document.getElementById('mapChart'), {
          type: 'line',
          data: {
            labels: data.epochs,
            datasets: [
              { label: 'mAP@0.5', data: data.map_50, borderColor: '#388e3c', backgroundColor: 'rgba(56,142,60,0.1)', fill: false },
              { label: 'mAP@0.5:0.95', data: data.map_5095, borderColor: '#fbc02d', backgroundColor: 'rgba(251,192,45,0.1)', fill: false }
            ]
          },
          options: {responsive:true, plugins:{legend:{position:'top'}}}
        });
        new Chart(document.getElementById('prChart'), {
          type: 'line',
          data: {
            labels: data.epochs,
            datasets: [
              { label: 'Precision', data: data.precision, borderColor: '#0288d1', backgroundColor: 'rgba(2,136,209,0.1)', fill: false },
              { label: 'Recall', data: data.recall, borderColor: '#c62828', backgroundColor: 'rgba(198,40,40,0.1)', fill: false }
            ]
          },
          options: {responsive:true, plugins:{legend:{position:'top'}}}
        });
      }
      // Update confusion matrix and sample predictions if needed
      if (data.confusion_matrix_path) {
        document.getElementById('mp-conf-matrix').src = `/static/${data.confusion_matrix_path}`;
      }
      if (data.sample_predictions && data.sample_predictions.length > 0) {
        const grid = document.getElementById('mp-sample-pred');
        grid.innerHTML = '';
        data.sample_predictions.forEach(imgPath => {
          const img = document.createElement('img');
          img.src = `/static/${imgPath}`;
          img.alt = 'Sample Prediction';
          img.style.maxWidth = '220px';
          img.style.borderRadius = '8px';
          img.style.border = '1px solid #eee';
          grid.appendChild(img);
        });
      }
    });
});
