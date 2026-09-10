const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskPriority = document.getElementById('taskPriority');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const taskCount = document.getElementById('taskCount');
const clearBtn = document.getElementById('clearBtn');
const filterBtns = document.querySelectorAll('.filter-btn');

let allTasks = [];
let activeFilter = 'all';

// 1. Initial Load
async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        allTasks = await res.json();
        render();
    } catch (err) {
        console.error('Failed to load tasks', err);
    }
}

// 2. Render Engine
function render() {
    taskList.innerHTML = '';

    // Filter Logic
    let filtered = allTasks.filter(task => {
        if (activeFilter === 'active') return !task.completed;
        if (activeFilter === 'completed') return task.completed;
        return true;
    });

    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(task => {
        const li = document.createElement('li');
        if (task.completed) li.classList.add('completed');

        // Bullet Checkbox
        const bullet = document.createElement('span');
        bullet.className = 'bullet';
        bullet.onclick = () => toggleTask(task.id);

        // Title
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = task.title;
        title.onclick = () => toggleTask(task.id);

        // Priority Badge
        const badge = document.createElement('span');
        badge.className = `badge ${task.priority || 'medium'}`;
        badge.textContent = task.priority || 'medium';

        // Delete Button
        const remove = document.createElement('button');
        remove.className = 'remove';
        remove.innerHTML = '✕';
        remove.onclick = () => deleteTask(task.id);

        li.append(bullet, title, badge, remove);
        taskList.appendChild(li);
    });

    // Update Counter
    const completedCount = allTasks.filter(t => t.completed).length;
    taskCount.textContent = `${completedCount} of ${allTasks.length} done`;
}

// 3. Add Task
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    const priority = taskPriority.value;
    if (!title) return;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, priority })
        });
        const newTask = await res.json();
        allTasks.unshift(newTask);
        taskInput.value = '';
        render();
    } catch (err) {
        console.error('Error adding task', err);
    }
});

// 4. Toggle Task
async function toggleTask(id) {
    try {
        const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH' });
        const updated = await res.json();
        const index = allTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            allTasks[index] = updated;
            render();
        }
    } catch (err) {
        console.error('Error toggling task', err);
    }
}

// 5. Delete Task
async function deleteTask(id) {
    try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        allTasks = allTasks.filter(t => t.id !== id);
        render();
    } catch (err) {
        console.error('Error deleting task', err);
    }
}

// 6. Clear All Completed
clearBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/tasks/clear-completed', { method: 'DELETE' });
        allTasks = allTasks.filter(t => !t.completed);
        render();
    } catch (err) {
        console.error('Error clearing tasks', err);
    }
});

// 7. Filter Tabs Switching
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        render();
    });
});

loadTasks();