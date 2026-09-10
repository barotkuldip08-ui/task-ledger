const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'tasks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getStoredTasks() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, '[]', 'utf8');
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        return [];
    }
}

function saveTasks(tasks) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
    } catch (err) {
        console.error('File write error:', err);
    }
}

// 1. Get all tasks
app.get('/api/tasks', (req, res) => {
    res.json(getStoredTasks());
});

// 2. Add task
app.post('/api/tasks', (req, res) => {
    const { title, priority, dueDate } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const tasks = getStoredTasks();
    const newTask = {
        id: Date.now().toString(),
        title: title.trim(),
        priority: priority || 'medium',
        dueDate: dueDate || null,
        completed: false,
        pinned: false,
        createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    saveTasks(tasks);
    res.status(201).json(newTask);
});

// 3. Batch reorder tasks
app.put('/api/tasks/reorder', (req, res) => {
    const { tasks } = req.body;
    if (Array.isArray(tasks)) {
        saveTasks(tasks);
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Invalid array' });
});

// 4. Update task (Toggle, Pin, Rename)
app.patch('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const tasks = getStoredTasks();
    const task = tasks.find(t => t.id === id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    if (req.body.title !== undefined) task.title = req.body.title.trim();
    if (req.body.completed !== undefined) task.completed = req.body.completed;
    else if (req.body.toggleCompleted) task.completed = !task.completed;
    if (req.body.togglePin) task.pinned = !task.pinned;

    saveTasks(tasks);
    res.json(task);
});

// 5. Clear completed
app.delete('/api/tasks/clear-completed', (req, res) => {
    let tasks = getStoredTasks();
    tasks = tasks.filter(t => !t.completed);
    saveTasks(tasks);
    res.json({ success: true });
});

// 6. Delete single task
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    let tasks = getStoredTasks();
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(tasks);
    res.json({ success: true, id });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});