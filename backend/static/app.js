/* Copied from frontend/app.js */
document.addEventListener('DOMContentLoaded', function() {
  // Fetch and display projects
  fetch('/api/projects')
    .then(res => res.json())
    .then(projects => {
      const listDiv = document.getElementById('projectList');
      if (projects.length === 0) {
        listDiv.innerHTML = "<p>No projects yet.</p>";
      } else {
        let html = "<h2>📂 Existing Projects</h2><ul>";
        projects.forEach(p => {
          html += `<li>
            <span class='project-link' data-project='${p}'>${p}</span>
          </li>`;
        });
        html += "</ul>";
        listDiv.innerHTML = html;
        // Add click listeners to project names
        document.querySelectorAll('.project-link').forEach(el => {
          el.onclick = function() {
            window.location.href = `project.html?name=${encodeURIComponent(this.dataset.project)}`;
          };
        });
      }
    });

  document.getElementById('createProjectBtn').onclick = function() {
    const name = prompt("Enter new project name:");
    if (name) {
      fetch('/api/projects', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({project_name: name})
      })
      .then(res => res.json().then(data => ({status: res.status, body: data})))
      .then(result => {
        if (result.status === 200) {
          alert(result.body.message);
          location.reload();
        } else {
          alert(result.body.error);
        }
      })
      .catch(() => alert('Failed to create project. Backend may be down.'));
    }
  };
});
