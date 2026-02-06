document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const taskInput = document.getElementById('task-input');
    const taskDate = document.getElementById('task-date');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const notifyBtn = document.getElementById('notify-btn');

    // State
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';

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
    filterBtns.forEach(btn => btn.addEventListener('click', (e) => {
        // UI Cleanup
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Logic
        currentFilter = e.target.dataset.filter;
        renderTasks();
    }));

    notifyBtn.addEventListener('click', requestNotificationPermission);

    // Check for due tasks every minute
    setInterval(checkDueTasks, 60000);
    // Initial check in case we opened the app and tasks are already due
    setTimeout(checkDueTasks, 2000);

    // Functions

    function addTask() {
        const title = taskInput.value.trim();
        const date = taskDate.value;

        if (title === '') {
            showToast('Please enter a task!', 'error');
            return;
        }

        const newTask = {
            id: Date.now().toString(),
            title: title,
            date: date, // ISO string likely
            completed: false,
            notified: false
        };

        tasks.push(newTask);
        saveTasks();
        renderTasks();

        // Reset inputs
        taskInput.value = '';
        taskDate.value = '';
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

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function renderTasks() {
        // Filter
        let filteredTasks = tasks;
        if (currentFilter === 'pending') {
            filteredTasks = tasks.filter(t => !t.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        }

        // Sort by date (if exists) then by id
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
            return;
        }

        filteredTasks.forEach(task => {
            // Format Date
            let dateDisplay = '';
            if (task.date) {
                const d = new Date(task.date);
                dateDisplay = `<i class="fa-regular fa-clock"></i> ${d.toLocaleString()}`;
            }

            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;

            li.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-content">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    ${dateDisplay ? `<div class="task-date">${dateDisplay}</div>` : ''}
                </div>
                <button class="delete-btn" aria-label="Delete Task">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            taskList.appendChild(li);
        });
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

        notif.onclick = () => {
            window.focus();
        };
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
