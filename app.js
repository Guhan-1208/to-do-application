document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const taskInput = document.getElementById('task-input');
    const taskDate = document.getElementById('task-date');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const notifyBtn = document.getElementById('notify-btn');
    const taskPriority = document.getElementById('task-priority');
    const themeBtn = document.getElementById('theme-btn');

    // State
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';

    // Theme Initialization
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Initialization
    renderTasks();
    if (Notification.permission === 'granted') {
        notifyBtn.style.color = 'var(--primary-color)';
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(console.error);
    }

    // Event Listeners
    addBtn.addEventListener('click', addTask);
    taskList.addEventListener('click', handleTaskAction);
    taskList.addEventListener('dblclick', handleTaskEdit); // Enable inline edit
    filterBtns.forEach(btn => btn.addEventListener('click', (e) => {
        // UI Cleanup
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Logic
        currentFilter = e.target.dataset.filter;
        renderTasks();
    }));

    notifyBtn.addEventListener('click', requestNotificationPermission);
    themeBtn.addEventListener('click', toggleTheme);

    // Check for due tasks every minute
    setInterval(checkDueTasks, 60000);
    // Initial check in case we opened the app and tasks are already due
    setTimeout(checkDueTasks, 2000);

    // Functions

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        const icon = themeBtn.querySelector('i');
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    function addTask() {
        const title = taskInput.value.trim();
        const date = taskDate.value;
        const priority = taskPriority.value;

        if (title === '') {
            showToast('Please enter a task!', 'error');
            return;
        }

        const newTask = {
            id: Date.now().toString(),
            title: title,
            date: date, // ISO string likely
            priority: priority,
            completed: false,
            notified: false
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();

        // Reset inputs
        taskInput.value = '';
        taskDate.value = '';
        taskPriority.value = 'medium'; // Reset to default
        showToast('Task added successfully', 'success');
    }

    function handleTaskAction(e) {
        const item = e.target;
        const taskItem = item.closest('.task-item');
        if (!taskItem) return;

        const id = taskItem.dataset.id;

        // Delete
        if (item.classList.contains('delete-btn') || item.closest('.delete-btn')) {
            deleteTask(id);
        }

        // Toggle Complete (Checkbox)
        if (item.classList.contains('task-checkbox')) {
            toggleTask(id);
        }
    }

    function handleTaskEdit(e) {
        const taskTitle = e.target.closest('.task-title');
        if (!taskTitle) return;

        const taskItem = taskTitle.closest('.task-item');
        const id = taskItem.dataset.id;
        const currentText = taskTitle.textContent;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'edit-input'; // We can style this if needed, or rely on defaults
        input.style.width = '100%';
        input.style.border = 'none';
        input.style.borderBottom = '1px solid var(--primary-color)';
        input.style.background = 'transparent';
        input.style.color = 'var(--text-primary)';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.outline = 'none';

        taskTitle.replaceWith(input);
        input.focus();

        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText) {
                updateTaskTitle(id, newText);
            } else {
                renderTasks(); // Revert if empty
            }
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });
    }

    function updateTaskTitle(id, newTitle) {
        tasks = tasks.map(task =>
            task.id === id ? { ...task, title: newTitle } : task
        );
        saveTasks();
        renderTasks();
    }

    function deleteTask(id) {
        tasks = tasks.filter(task => task.id !== id);
        saveTasks();
        renderTasks();
        showToast('Task deleted', 'success');
    }

    function toggleTask(id) {
        tasks = tasks.map(task => {
            if (task.id === id) {
                return { ...task, completed: !task.completed };
            }
            return task;
        });
        saveTasks();
        renderTasks();
    }

    // Calls to updateProgress
    // We need to call updateProgress() whenever tasks are modified (add, delete, toggle, load)

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        updateProgress(); // Update progress on save
    }

    function renderTasks() {
        // Filter logic...
        let filteredTasks = tasks;
        if (currentFilter === 'pending') {
            filteredTasks = tasks.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        }

        // Sort logic...
        filteredTasks.sort((a, b) => {
            if (a.date && b.date) return new Date(a.date) - new Date(b.date);
            if (a.date) return -1;
            if (b.date) return 1;
            return 0; // Keep order
        });

        // Clear list
        taskList.innerHTML = '';

        if (filteredTasks.length === 0) {
            taskList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clipboard-list"></i>
                    <p>No ${currentFilter === 'all' ? '' : currentFilter} tasks found.</p>
                </div>
            `;
            // We don't return here if we want to ensure progress is updated even if empty view
            // But usually renderTasks is called after saveTasks which calls updateProgress
            // So it's fine.
        } else {
            // Render items
            filteredTasks.forEach(task => { // ... existing render logic
                // Format Date
                let dateDisplay = '';
                if (task.date) {
                    const d = new Date(task.date);
                    dateDisplay = `<i class="fa-regular fa-clock"></i> ${d.toLocaleString()}`;
                }

                const priorityClass = task.priority ? `priority-${task.priority}` : 'priority-medium';

                const li = document.createElement('li');
                li.className = `task-item ${task.completed ? 'completed' : ''} ${priorityClass}`;
                li.dataset.id = task.id;

                li.innerHTML = `
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <div class="task-content">
                        <div class="task-title" title="Double click to edit">${escapeHtml(task.title)}</div>
                        ${dateDisplay ? `<div class="task-date">${dateDisplay}</div>` : ''}
                    </div>
                    <button class="delete-btn" aria-label="Delete Task">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
                taskList.appendChild(li);
            });
        }

        updateProgress(); // Ensure progress is correct on render (initial load)
    }

    function updateProgress() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill && progressText) {
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${percentage}%`;
        }

        if (total > 0 && completed === total) {
            launchConfetti();
        }
    }

    // Confetti Logic
    function launchConfetti() {
        // Simple canvas confetti implementation
        // Prevent spamming if already running? 
        // Let's allow it for every 100% completion trigger (e.g. last task checked)

        const canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const pieces = [];
        const numberOfPieces = 100;
        const colors = ['#6c5ce7', '#00b894', '#fdcb6e', '#ff7675', '#74b9ff'];

        for (let i = 0; i < numberOfPieces; i++) {
            pieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                rotation: Math.random() * 360,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 10 + 5,
                speed: Math.random() * 5 + 2
            });
        }

        let animationId;

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            pieces.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();

                p.y += p.speed;
                p.rotation += 2;

                if (p.y > canvas.height) {
                    p.y = -20; // reset to top
                }
            });

            animationId = requestAnimationFrame(animate);
        }

        animate();

        // Stop after 3 seconds
        setTimeout(() => {
            cancelAnimationFrame(animationId);
            canvas.remove();
        }, 3000);
    }


    function requestNotificationPermission() {
        if (!("Notification" in window)) {
            showToast("This browser does not support desktop notifications", "error");
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                showToast("Notifications enabled!", "success");
                notifyBtn.style.color = 'var(--primary-color)';
                // Test notification
                new Notification("To-Do List", {
                    body: "Notifications are set up correctly!",
                    icon: "https://cdn-icons-png.flaticon.com/512/906/906334.png"
                });
            }
        });
    }

    function checkDueTasks() {
        if (Notification.permission !== "granted") return;

        const now = new Date();
        tasks.forEach(task => {
            if (task.date && !task.completed && !task.notified) {
                const taskDate = new Date(task.date);
                // If the task time is passed or is within the last minute
                if (taskDate <= now) {
                    sendNotification(task);
                    task.notified = true; // prevent spamming
                    saveTasks(); // save the notified state
                }
            }
        });
    }

    function sendNotification(task) {
        const notif = new Notification("To-Do Reminder: " + task.title, {
            body: `It's time to: ${task.title}`,
            icon: "https://cdn-icons-png.flaticon.com/512/906/906334.png"
        });

        playNotificationSound();

        notif.onclick = () => {
            window.focus();
        };
    }

    function playNotificationSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Pleasant chime sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            oscillator.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6

            gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio play failed", e);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Simple Toast functionality
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return; // Should exist, but for safety

        // Only create functionality dynamically since it wasn't in main CSS
        // Adding quick styles for toast here via JS or assume added to CSS.
        // I will add the CSS block to the style element if not present?
        // Actually, let's just make it simple.

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = `
            background: ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            margin-top: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
            max-width: 300px;
            text-align: center;
        `;
        toast.textContent = message;

        // Ensure container is positioned
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});
