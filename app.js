let config = null;

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const configRes = await fetch("config.json");
        if (!configRes.ok) throw new Error("Could not load config.json");
        config = await configRes.json();

        fetchTasks();
    } catch (err) {
        showStatus("Failed to load configuration: " + err.message, true);
    }

    document.getElementById("task-form").addEventListener("submit", handleFormSubmit);
    document.getElementById("task-cancel").addEventListener("click", resetForm);
});

// Helper Headers
function getHeaders(extraHeaders = {}) {
    return {
        "apikey": config.supabasePublishableKey,
        "Authorization": `Bearer ${config.supabasePublishableKey}`,
        "Content-Type": "application/json",
        ...extraHeaders
    };
}

// Show Status / Error Message
function showStatus(msg, isError = false) {
    const statusElem = document.getElementById("status-message");
    statusElem.textContent = msg;
    statusElem.className = isError ? "status-error" : "status-success";
    statusElem.style.display = "block";
    setTimeout(() => {
        statusElem.style.display = "none";
    }, 4000);
}

// 1. Fetch All Tasks (GET)
async function fetchTasks() {
    try {
        const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?select=*&order=id.asc`, {
            method: "GET",
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const tasks = await res.json();
        renderTasks(tasks);
    } catch (err) {
        showStatus("Error fetching tasks: " + err.message, true);
    }
}

// Render Tasks to DOM
function renderTasks(tasks) {
    const listContainer = document.getElementById("task-list");
    listContainer.innerHTML = "";

    if (tasks.length === 0) {
        listContainer.innerHTML = "<p>No tasks found.</p>";
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item";
        item.setAttribute("data-id", task.id);

        item.innerHTML = `
      <div class="task-header">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-status ${task.completed ? 'status-completed' : 'status-pending'}">
          ${task.completed ? "Completed" : "Incomplete"}
        </span>
      </div>
      <div class="task-description">${escapeHtml(task.description || "")}</div>
      <div class="task-actions">
        <button class="toggle-task" onclick="toggleTaskStatus(${task.id}, ${task.completed})">
          ${task.completed ? "Mark Incomplete" : "Mark Complete"}
        </button>
        <button class="edit-task" onclick="startEditTask(${task.id}, '${escapeQuotes(task.title)}', '${escapeQuotes(task.description || '')}')">Edit</button>
        <button class="delete-task" onclick="deleteTask(${task.id})">Delete</button>
      </div>
    `;
        listContainer.appendChild(item);
    });
}

// 2. Add or Edit Task (POST / PUT)
async function handleFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("task-title").value.trim();
    const description = document.getElementById("task-description").value.trim();
    const editingId = document.getElementById("editing-id").value;

    if (!title) return;

    try {
        if (editingId) {
            // Edit mode (PUT)
            const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${editingId}`, {
                method: "PUT",
                headers: getHeaders({ "Prefer": "return=representation" }),
                body: JSON.stringify({
                    id: parseInt(editingId, 10),
                    title: title,
                    description: description
                })
            });
            if (!res.ok) throw new Error("Failed to update task");
            showStatus("Task updated successfully!");
        } else {
            // Create mode (POST)
            const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}`, {
                method: "POST",
                headers: getHeaders({ "Prefer": "return=representation" }),
                body: JSON.stringify({
                    title: title,
                    description: description,
                    completed: false
                })
            });
            if (!res.ok) throw new Error("Failed to create task");
            showStatus("Task added successfully!");
        }

        resetForm();
        fetchTasks();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// 3. Toggle Complete Status (PATCH / PUT)
async function toggleTaskStatus(id, currentStatus) {
    try {
        const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({ completed: !currentStatus })
        });
        if (!res.ok) throw new Error("Failed to change status");
        fetchTasks();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// 4. Delete Task (DELETE)
async function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
        const res = await fetch(`${config.supabaseUrl}/rest/v1/${config.tableName}?id=eq.${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        if (!res.ok) throw new Error("Failed to delete task");
        showStatus("Task deleted!");
        fetchTasks();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// Form Helpers
function startEditTask(id, title, description) {
    document.getElementById("editing-id").value = id;
    document.getElementById("task-title").value = title;
    document.getElementById("task-description").value = description;
    document.getElementById("task-submit").textContent = "Save Changes";
    document.getElementById("task-cancel").style.display = "inline-block";
}

function resetForm() {
    document.getElementById("editing-id").value = "";
    document.getElementById("task-title").value = "";
    document.getElementById("task-description").value = "";
    document.getElementById("task-submit").textContent = "Add Task";
    document.getElementById("task-cancel").style.display = "none";
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}