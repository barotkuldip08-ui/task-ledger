const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskPriority = document.getElementById('taskPriority');
const taskDueDate = document.getElementById('taskDueDate');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const taskStats = document.getElementById('taskStats');
const streakCount = document.getElementById('streakCount');
const currentXpEl = document.getElementById('currentXp');
const xpBar = document.getElementById('xpBar');
const rankBadge = document.getElementById('rankBadge');
const clearBtn = document.getElementById('clearBtn');
const filterBtns = document.querySelectorAll('.tab-btn');
const searchInput = document.getElementById('searchInput');

// Pomodoro Elements
const pomoDisplay = document.getElementById('pomoDisplay');
const pomoToggle = document.getElementById('pomoToggle');
const pomoReset = document.getElementById('pomoReset');

// Telemetry & Modal Elements
const analyticsBtn = document.getElementById('analyticsBtn');
const telemetryModal = document.getElementById('telemetryModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const kpiRate = document.getElementById('kpiRate');
const kpiXp = document.getElementById('kpiXp');
const kpiPending = document.getElementById('kpiPending');
const exportCsvBtn = document.getElementById('exportCsvBtn');

let allTasks = [];
let activeFilter = 'all';
let searchQuery = '';
let priorityChartInstance = null;
let statusChartInstance = null;

// XP & Gamification Engine
let userXp = parseInt(localStorage.getItem('ledger_xp') || '0', 10);
let userStreak = parseInt(localStorage.getItem('ledger_streak') || '1', 10);

const RANKS = [
    { threshold: 0, title: 'LVL 1 // ROOKIE' },
    { threshold: 250, title: 'LVL 2 // OPERATOR' },
    { threshold: 600, title: 'LVL 3 // FOCUS SPECIALIST' },
    { threshold: 1200, title: 'LVL 4 // ARCHITECT' },
    { threshold: 2000, title: 'LVL 5 // CYBER CYBORG' }
];

function addXp(amount) {
    userXp += amount;
    localStorage.setItem('ledger_xp', userXp);
    updateGamificationUI();
}

function updateGamificationUI() {
    currentXpEl.textContent = userXp;
    streakCount.textContent = `🔥 ${userStreak} Day Streak`;

    let currentRank = RANKS[0];
    let nextThreshold = 250;

    for (let i = 0; i < RANKS.length; i++) {
        if (userXp >= RANKS[i].threshold) {
            currentRank = RANKS[i];
            nextThreshold = RANKS[i + 1] ? RANKS[i + 1].threshold : currentRank.threshold;
        }
    }

    rankBadge.textContent = currentRank.title;
    const prevThreshold = currentRank.threshold;
    const progress = nextThreshold === prevThreshold ? 100 : Math.min(100, Math.round(((userXp - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
    xpBar.style.width = `${progress}%`;
}

// Audio Synthesizer
let audioCtx = null;
function playSound(type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'done') {
            osc.frequency.setValueAtTime(520, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1040, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
        } else if (type === 'delete') {
            osc.frequency.setValueAtTime(280, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(120, audioCtx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        }
    } catch (e) {}
}

// Interactive Spotlight
window.addEventListener('mousemove', (e) => {
    document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
    document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
});

// Pomodoro Timer Engine
let pomoTime = 25 * 60;
let pomoInterval = null;
let isPomoRunning = false;

function renderPomo() {
    const mins = Math.floor(pomoTime / 60);
    const secs = pomoTime % 60;
    pomoDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

pomoToggle.addEventListener('click', () => {
    if (isPomoRunning) {
        clearInterval(pomoInterval);
        pomoToggle.textContent = '▶';
    } else {
        pomoToggle.textContent = '⏸';
        pomoInterval = setInterval(() => {
            if (pomoTime > 0) {
                pomoTime--;
                renderPomo();
            } else {
                clearInterval(pomoInterval);
                isPomoRunning = false;
                pomoToggle.textContent = '▶';
                addXp(150);
                if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80 });
                alert('Focus Session Completed! +150 XP');
            }
        }, 1000);
    }
    isPomoRunning = !isPomoRunning;
});

pomoReset.addEventListener('click', () => {
    clearInterval(pomoInterval);
    isPomoRunning = false;
    pomoTime = 25 * 60;
    pomoToggle.textContent = '▶';
    renderPomo();
});

// Load Tasks
async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        allTasks = await res.json();
        render();
        updateGamificationUI();
    } catch (err) {
        console.error(err);
    }
}

function getDueDateStatus(dueDateStr) {
    if (!dueDateStr) return null;
    const target = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diff = target - today;
    const days = Math.round(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return { text: `Overdue (${Math.abs(days)}d ago)`, isOverdue: true };
    if (days === 0) return { text: 'Today', isOverdue: false };
    if (days === 1) return { text: 'Tomorrow', isOverdue: false };
    return { text: `In ${days}d`, isOverdue: false };
}

// Render Tasks
function render() {
    taskList.innerHTML = '';

    const sorted = [...allTasks].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    const filtered = sorted.filter(task => {
        const matchesFilter = 
            activeFilter === 'active' ? !task.completed :
            activeFilter === 'completed' ? task.completed : true;
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach((task, idx) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.id = task.id;
        li.dataset.index = idx;

        if (task.completed) li.classList.add('completed');
        if (task.pinned) li.classList.add('pinned');

        const bullet = document.createElement('span');
        bullet.className = 'bullet';
        bullet.onclick = () => toggleTask(task.id);

        const content = document.createElement('div');
        content.className = 'task-content';

        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = task.title;
        title.title = 'Double click to edit';

        title.addEventListener('dblclick', () => {
            title.contentEditable = 'true';
            title.focus();
        });

        title.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                title.blur();
            }
        });

        title.addEventListener('blur', async () => {
            title.contentEditable = 'false';
            const newTitle = title.textContent.trim();
            if (newTitle && newTitle !== task.title) {
                await updateTaskTitle(task.id, newTitle);
            }
        });

        content.appendChild(title);

        if (task.dueDate) {
            const dateStatus = getDueDateStatus(task.dueDate);
            if (dateStatus) {
                const dueTag = document.createElement('span');
                dueTag.className = `due-tag ${dateStatus.isOverdue && !task.completed ? 'overdue' : ''}`;
                dueTag.textContent = `⚡ ${dateStatus.text}`;
                content.appendChild(dueTag);
            }
        }

        const badge = document.createElement('span');
        badge.className = `badge ${task.priority || 'medium'}`;
        badge.textContent = task.priority || 'medium';

        const star = document.createElement('button');
        star.className = `star-btn ${task.pinned ? 'active' : ''}`;
        star.innerHTML = task.pinned ? '★' : '☆';
        star.onclick = (e) => {
            e.stopPropagation();
            togglePin(task.id);
        };

        const remove = document.createElement('button');
        remove.className = 'remove-btn';
        remove.innerHTML = '✕';
        remove.onclick = (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        };

        li.append(bullet, content, badge, star, remove);

        li.addEventListener('dragstart', () => li.classList.add('dragging'));
        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
            persistReorder();
        });

        taskList.appendChild(li);
    });

    taskList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;
        const siblings = [...taskList.querySelectorAll('li:not(.dragging)')];
        const nextSibling = siblings.find(sibling => e.clientY <= sibling.offsetTop + sibling.offsetHeight / 2);
        taskList.insertBefore(draggingItem, nextSibling);
    });

    const completedCount = allTasks.filter(t => t.completed).length;
    taskStats.textContent = `${completedCount} of ${allTasks.length} Completed`;
}

// Reorder Sync
async function persistReorder() {
    const currentDomIds = [...taskList.querySelectorAll('li')].map(li => li.dataset.id);
    allTasks.sort((a, b) => currentDomIds.indexOf(a.id) - currentDomIds.indexOf(b.id));

    try {
        await fetch('/api/tasks/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: allTasks })
        });
    } catch (e) {
        console.error('Failed to sync reorder', e);
    }
}

// Inline Rename
async function updateTaskTitle(id, newTitle) {
    try {
        await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        const target = allTasks.find(t => t.id === id);
        if (target) target.title = newTitle;
    } catch (e) {
        console.error(e);
    }
}

// Add Task
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    const priority = taskPriority.value;
    const dueDate = taskDueDate.value;
    if (!title) return;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, priority, dueDate })
        });
        const newTask = await res.json();
        allTasks.unshift(newTask);
        taskInput.value = '';
        taskDueDate.value = '';
        render();
    } catch (err) {
        console.error(err);
    }
});

// Toggle Task
async function toggleTask(id) {
    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toggleCompleted: true })
        });
        const updated = await res.json();
        const index = allTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            allTasks[index] = updated;
            if (updated.completed) {
                playSound('done');
                const xpGain = updated.priority === 'high' ? 100 : updated.priority === 'low' ? 25 : 50;
                addXp(xpGain);
            }
            render();
        }
    } catch (err) {
        console.error(err);
    }
}

// Toggle Pin
async function togglePin(id) {
    try {
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ togglePin: true })
        });
        const updated = await res.json();
        const index = allTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            allTasks[index] = updated;
            render();
        }
    } catch (err) {
        console.error(err);
    }
}

// Delete Task
async function deleteTask(id) {
    playSound('delete');
    try {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        allTasks = allTasks.filter(t => t.id !== id);
        render();
    } catch (err) {
        console.error(err);
    }
}

// Clear Completed
clearBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/tasks/clear-completed', { method: 'DELETE' });
        allTasks = allTasks.filter(t => !t.completed);
        render();
    } catch (err) {
        console.error(err);
    }
});

// Search Filter
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
});

// Shortcuts
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
    if (e.key === 'Escape' && !telemetryModal.classList.contains('hidden')) {
        closeModal();
    }
});

// Tab Filters
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        render();
    });
});

// =======================================
// TELEMETRY & CHART.JS ENGINE
// =======================================
function openTelemetry() {
    telemetryModal.classList.remove('hidden');

    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    kpiRate.textContent = `${rate}%`;
    kpiXp.textContent = `${userXp} XP`;
    kpiPending.textContent = pending;

    const highCount = allTasks.filter(t => t.priority === 'high').length;
    const medCount = allTasks.filter(t => t.priority === 'medium').length;
    const lowCount = allTasks.filter(t => t.priority === 'low').length;

    if (priorityChartInstance) priorityChartInstance.destroy();
    if (statusChartInstance) statusChartInstance.destroy();

    const pCtx = document.getElementById('priorityChart').getContext('2d');
    priorityChartInstance = new Chart(pCtx, {
        type: 'doughnut',
        data: {
            labels: ['High', 'Med', 'Low'],
            datasets: [{
                data: [highCount, medCount, lowCount],
                backgroundColor: ['#f43f5e', '#f59e0b', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            cutout: '72%'
        }
    });

    const sCtx = document.getElementById('statusChart').getContext('2d');
    statusChartInstance = new Chart(sCtx, {
        type: 'doughnut',
        data: {
            labels: ['Done', 'Active'],
            datasets: [{
                data: [completed, pending],
                backgroundColor: ['#10b981', '#334155'],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            cutout: '72%'
        }
    });
}

function closeModal() {
    telemetryModal.classList.add('hidden');
}

analyticsBtn.addEventListener('click', openTelemetry);
closeModalBtn.addEventListener('click', closeModal);
telemetryModal.addEventListener('click', (e) => {
    if (e.target === telemetryModal) closeModal();
});

// CSV Export Generator with Fallbacks
exportCsvBtn.addEventListener('click', () => {
    if (allTasks.length === 0) return alert('No tasks to export!');

    let csv = 'ID,Title,Priority,Completed,DueDate,CreatedAt\n';
    allTasks.forEach(t => {
        const priority = t.priority || 'medium';
        const dueDate = t.dueDate || 'No Deadline';
        const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : 'Legacy Task';
        csv += `"'${t.id}'","${t.title.replace(/"/g, '""')}","${priority}","${t.completed}","${dueDate}","${createdAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Task_Ledger_Telemetry_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});