import { useEffect } from 'react';
import { formatDate } from '../utils/dateUtils';

export function useNotifications(habits, tasks) {
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const checkNotifications = () => {
      const now     = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today   = formatDate(now);

      habits.forEach(habit => {
        if (!habit.reminderTime || habit.reminderTime !== timeStr) return;

        const task = tasks.find(t => t.habitId === habit.id && t.date === today);
        if (!task) return;

        // Проверяваме дали задачата е завършена
        const isCompleted =
          task.status === 'completed' ||
          (task.completions?.length > 0 && task.completions.every(c => c.completed)) ||
          (task.subtasks?.length > 0   && task.subtasks.every(s => s.completed));

        if (isCompleted) return;

        // Предотвратяваме дублирани нотификации
        const key      = `lastNotif_${habit.id}_${today}`;
        const lastSent = localStorage.getItem(key);
        if (lastSent && Date.now() - parseInt(lastSent) < 60000) return;

        // Изпращаме нотификация
        const body = getProgressBody(task);
        sendNotification(`Време за: ${habit.name} 🎯`, body, `reminder-${habit.id}`);
        localStorage.setItem(key, Date.now().toString());
      });
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 60000);
    return () => clearInterval(interval);
  }, [habits, tasks]);
}

const getProgressBody = (task) => {
  if (task.completions?.length > 0) {
    const done = task.completions.filter(c => c.completed).length;
    return `${done}/${task.completions.length} завършени`;
  }
  if (task.subtasks?.length > 0) {
    const done = task.subtasks.filter(s => s.completed).length;
    return `${done}/${task.subtasks.length} подзадачи завършени`;
  }
  return 'Незавършена задача';
};

const sendNotification = (title, body, tag) => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SEND_NOTIFICATION', title, body,
      icon: '/icon-192.png', tag, requireInteraction: true,
    });
  } else {
    new Notification(title, { body, icon: '/icon-192.png', tag, requireInteraction: true });
  }
};