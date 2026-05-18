import { todayKey } from '../utils/date';

const FIRED_PREFIX = 'reflectflow_notifications_fired_';
const MOTIVATIONAL = [
  'Consistency compounds. Show up today.',
  'Your future self will thank you.',
  'Small actions, strong identity.',
  'Protect the promise you made to yourself.'
];

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

export function getNotificationStatus(settings = {}) {
  if (!isSupported()) return { state: 'unsupported', label: 'Unsupported browser', detail: 'This browser does not support local notifications.' };
  const permission = getPermission();
  if (permission === 'denied') return { state: 'blocked', label: 'Blocked', detail: 'Notifications are blocked. Enable them in your browser site settings.' };
  if (!settings.notifications) return { state: 'disabled', label: 'Disabled', detail: 'Reminders are off for this app.' };
  if (permission === 'granted') return { state: 'granted', label: 'Enabled', detail: 'Browser reminders are active while the app is open.' };
  return { state: 'default', label: 'Permission needed', detail: 'Enable notifications to receive habit reminders.' };
}

export async function requestNotificationPermission() {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
  } catch (error) {
    console.warn('ReflectFlow notification service worker unavailable:', error);
    return null;
  }
}

function randomMotivation() {
  return MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
}

export function buildReminderNotification(reminder) {
  const title = reminder.habitMatch || reminder.label || 'Habit reminder';
  const body = reminder.message || `${title} - ${randomMotivation()}`;
  return {
    title,
    options: {
      body,
      icon: '/icons/favicon.svg',
      badge: '/icons/favicon.svg',
      tag: `reflectflow-${reminder.id}`,
      renotify: false,
      requireInteraction: false,
      data: {
        reminderId: reminder.id,
        url: '/habits'
      }
    }
  };
}

export async function showReminderNotification(reminder) {
  if (!isSupported() || getPermission() !== 'granted') return false;
  const { title, options } = buildReminderNotification(reminder);

  const registration = await getServiceWorkerRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return true;
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
  return true;
}

function parseTime(timeStr) {
  const [hours, minutes] = String(timeStr || '').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return { hours, minutes };
}

export function shouldFire(reminder, now = new Date()) {
  if (!reminder.enabled) return false;
  const parsed = parseTime(reminder.time);
  if (!parsed) return false;
  return now.getHours() === parsed.hours && now.getMinutes() === parsed.minutes;
}

function getFiredStorageKey(dateKey = todayKey()) {
  return `${FIRED_PREFIX}${dateKey}`;
}

function readFired(dateKey = todayKey()) {
  try {
    return JSON.parse(localStorage.getItem(getFiredStorageKey(dateKey)) || '{}');
  } catch (_) {
    return {};
  }
}

function writeFired(fired, dateKey = todayKey()) {
  localStorage.setItem(getFiredStorageKey(dateKey), JSON.stringify(fired));
}

function cleanupOldFiredLogs(currentKey = todayKey()) {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(FIRED_PREFIX) && key !== getFiredStorageKey(currentKey))
    .forEach((key) => localStorage.removeItem(key));
}

export async function checkReminders(state, now = new Date()) {
  const status = getNotificationStatus(state.settings);
  if (status.state !== 'granted') return { fired: 0, status };

  const dateKey = todayKey();
  cleanupOldFiredLogs(dateKey);
  const fired = readFired(dateKey);
  let count = 0;

  for (const reminder of state.settings.reminders || []) {
    if (!shouldFire(reminder, now)) continue;
    const slot = `${reminder.id}_${now.getHours()}:${now.getMinutes()}`;
    if (fired[slot]) continue;

    try {
      const shown = await showReminderNotification(reminder);
      if (shown) {
        fired[slot] = new Date().toISOString();
        count++;
      }
    } catch (error) {
      console.warn('ReflectFlow reminder notification failed:', { reminder, error });
    }
  }

  if (count) writeFired(fired, dateKey);
  return { fired: count, status };
}
