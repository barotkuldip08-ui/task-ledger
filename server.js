const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'tasks.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Tasks read karna
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

// Helper: Tasks save karna
function saveTasks(tasks) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
    } catch (err) {
        console.error('File write error:', err);
    }
}

// 1. Saare tasks fetch karna (GET)
app.get('/api/tasks', (req, res) => {
    res.json(getStoredTasks());
});

// 2. Naya task add karna (POST)
app.post('/api/tasks', (req, res) => {
    const { title, priority } = req.body;
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' });
    }

    const tasks = getStoredTasks();
    const newTask = {
        id: Date.now().toString(),
        title: title.trim(),
        priority: priority || 'medium',
        completed: false
    };

    tasks.unshift(newTask);
    saveTasks(tasks);
    res.status(201).json(newTask);
});

// 3. Clear all completed tasks (DELETE)
app.delete('/api/tasks/clear-completed', (req, res) => {
    let tasks = getStoredTasks();
    tasks = tasks.filter(t => !t.completed);
    saveTasks(tasks);
    res.json({ success: true });
});

// 4. Task status toggle (PATCH/PUT)
const toggleTaskHandler = (req, res) => {
    const { id } = req.params;
    const tasks = getStoredTasks();
    const task = tasks.find(t => t.id === id);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    task.completed = !task.completed;
    saveTasks(tasks);
    res.json(task);
};

app.patch('/api/tasks/:id', toggleTaskHandler);
app.put('/api/tasks/:id', toggleTaskHandler);

// 5. Single task delete karna (DELETE)
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