require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://barotkuldip08_db_user:bH5iwvSabOP4eg2q@cluster0.dyyyjch.mongodb.net/taskledger?retryWrites=true&w=majority';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas Cloud Database
mongoose.connect(MONGODB_URI)
    .then(() => console.log('⚡ Connected to MongoDB Atlas Cloud Database'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Task Schema & Model
const taskSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    priority: { type: String, default: 'medium' },
    dueDate: { type: String, default: null },
    pinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    order: { type: Number, default: 0 }
});

const Task = mongoose.model('Task', taskSchema);

// 1. GET all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find().sort({ pinned: -1, order: 1, createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// 2. POST create task
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, priority, dueDate } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Task title is required' });
        }

        const newTask = new Task({
            id: Date.now().toString(),
            title: title.trim(),
            priority: priority || 'medium',
            dueDate: dueDate || null,
            completed: false,
            pinned: false,
            order: 0
        });

        const savedTask = await newTask.save();
        res.status(201).json(savedTask);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// 3. PATCH update task (Inline rename, priority, deadline, toggle completion, pin)
app.patch('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, priority, dueDate, toggleCompleted, togglePin } = req.body;

        const task = await Task.findOne({ id });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (title !== undefined) task.title = title.trim();
        if (priority !== undefined) task.priority = priority;
        if (dueDate !== undefined) task.dueDate = dueDate;
        if (toggleCompleted) task.completed = !task.completed;
        if (togglePin) task.pinned = !task.pinned;

        await task.save();
        res.json(task);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// 4. PUT reorder tasks (Drag and drop sync)
app.put('/api/tasks/reorder', async (req, res) => {
    try {
        const { tasks } = req.body;
        if (!Array.isArray(tasks)) {
            return res.status(400).json({ error: 'Invalid tasks array' });
        }

        const bulkOps = tasks.map((task, index) => ({
            updateOne: {
                filter: { id: task.id },
                update: { $set: { order: index } }
            }
        }));

        await Task.bulkWrite(bulkOps);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reorder tasks' });
    }
});

// 5. DELETE single task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Task.deleteOne({ id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// 6. DELETE clear completed tasks (Purge Done)
app.delete('/api/tasks/clear-completed', async (req, res) => {
    try {
        await Task.deleteMany({ completed: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear completed tasks' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});