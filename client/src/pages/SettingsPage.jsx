import { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { safeDownloadFile, safeOpenPrintWindow } from '../utils/browser';
import { todayKey } from '../utils/date';
import { exportCSV, exportDaySheetCSV, exportDaySheetJSON, exportJSON, getJournalForDate } from '../storage/storageService';
import { isScheduledDay, getStatus } from '../services/streakService';
import { todayStats } from '../services/analyticsService';
import { escapeHTML } from '../utils/security';

export default function SettingsPage() {
  const { state, ui, actions } = useApp();
  const importRef = useRef(null);
  const day = todayKey();

  const download = (name, content, type) => safeDownloadFile(name, content, type, {
    onSuccess: (fileName) => actions.toast(`${fileName} downloaded`, 'success'),
    onError: () => actions.toast('Export failed. Please try again.', 'error')
  });

  const importFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        actions.importBackup(reader.result);
      } catch (error) {
        console.warn('Import failed. The selected file was not applied.', error);
        actions.toast(error.message || 'Import failed. Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="section active">
      <header className="section-header">
        <div><h1>Settings</h1><p className="subtitle">Customize your experience</p></div>
      </header>
      <div className="settings-grid">
        <article className="card glass setting-card">
          <h2>Appearance</h2>
          <label className="setting-row">
            <span>Theme</span>
            <select value={state.settings.theme} onChange={(e) => actions.updateSettings({ theme: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Dashboard Layout</span>
            <select value={state.settings.layout} onChange={(e) => actions.updateSettings({ layout: e.target.value })}>
              <option value="default">Default</option>
              <option value="compact">Compact</option>
              <option value="wide">Wide</option>
            </select>
          </label>
        </article>

        <article className="card glass setting-card">
          <h2>Notifications</h2>
          <label className="setting-row toggle-row">
            <span>Enable reminders</span>
            <input type="checkbox" className="toggle" checked={!!state.settings.notifications} onChange={(e) => actions.setNotificationsEnabled(e.target.checked)} />
          </label>
          <div className={`notification-status notification-status--${ui.notificationStatus?.state || 'disabled'}`}>
            <strong>{ui.notificationStatus?.label || 'Disabled'}</strong>
            <span>{ui.notificationStatus?.detail || 'Reminders are off for this app.'}</span>
          </div>
          <div className="reminder-list">
            {state.settings.reminders.map((r) => (
              <label className="reminder-row" key={r.id}>
                <input type="checkbox" checked={!!r.enabled} onChange={(e) => actions.updateReminder(r.id, { enabled: e.target.checked })} />
                <span className="reminder-label">{r.label}</span>
                <input type="time" value={r.time} title={r.message} onChange={(e) => actions.updateReminder(r.id, { time: e.target.value })} />
              </label>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn-sm" onClick={() => actions.enableNotifications()}>Enable Browser Notifications</button>
        </article>

        <article className="card glass setting-card">
          <h2>Data</h2>
          <div className="setting-actions">
            <button type="button" className="btn btn--primary" onClick={() => download(`reflectflow-${day}.csv`, exportDaySheetCSV(state, day), 'text/csv')}>Download Today&apos;s Sheet (CSV)</button>
            <button type="button" className="btn btn--secondary" onClick={() => download(`reflectflow-${day}.json`, exportDaySheetJSON(state, day), 'application/json')}>Today&apos;s Sheet (JSON)</button>
            <button type="button" className="btn btn--secondary" onClick={() => download('reflectflow-backup.json', exportJSON(state), 'application/json')}>Export All JSON</button>
            <button type="button" className="btn btn--secondary" onClick={() => download('reflectflow-data.csv', exportCSV(state), 'text/csv')}>Export All CSV</button>
            <button type="button" className="btn btn--secondary" onClick={() => printReport(state, actions.toast)}>Print Today&apos;s Report</button>
            <button type="button" className="btn btn--secondary" onClick={() => importRef.current?.click()}>Import JSON</button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </article>

        <article className="card glass setting-card danger-zone">
          <h2>Danger Zone</h2>
          <p>Reset all progress to zero and start fresh from today. Your default habits stay; history, streaks, and notes are cleared.</p>
          <button type="button" className="btn btn--danger" onClick={() => window.confirm('Reset ALL data? This cannot be undone.') && actions.resetAll()}>Reset All Data</button>
        </article>

        <article className="card glass setting-card">
          <h2>Keyboard Shortcuts</h2>
          <ul className="shortcuts-list">
            <li><kbd>Ctrl</kbd>+<kbd>K</kbd> - Search</li>
            <li><kbd>N</kbd> - New habit</li>
            <li><kbd>T</kbd> - Toggle theme</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function printReport(state, toast) {
  try {
    if (!state || !Array.isArray(state.habits)) {
      throw new Error('Current app state is not ready for printing.');
    }

    const dateKey = todayKey();
    const stats = todayStats(state);
    const d = new Date(`${dateKey}T12:00:00`);
    const journal = getJournalForDate(state, dateKey);
    const habitsHtml = state.habits
      .filter((habit) => isScheduledDay(habit, d))
      .map((habit) => `<tr><td>${escapeHTML(habit.title)}</td><td>${escapeHTML(getStatus(habit, dateKey) || 'pending')}</td><td>${escapeHTML(habit.target || '-')}</td><td>${escapeHTML((habit.habitNotes || {})[dateKey] || '-')}</td></tr>`)
      .join('');
    const journalHtml = journal
      ? `<p><strong>Mood:</strong> ${escapeHTML(journal.mood)}</p><p>${escapeHTML(journal.content)}</p>`
      : '<p><em>No journal entry for this day.</em></p>';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ReflectFlow - ${dateKey}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:2rem;max-width:800px;margin:0 auto;color:#18181b}h1{margin-bottom:.25rem}h2{margin-top:1.5rem}table{width:100%;border-collapse:collapse;margin:1rem 0}td,th{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}th{background:#f4f4f5}.journal{background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e4e4e7}@media print{body{padding:.5rem}}</style></head><body><h1>Daily Sheet - ${dateKey}</h1><p>Generated ${new Date().toLocaleString()}</p><p><strong>Productivity:</strong> ${stats.score}% (${stats.completed}/${stats.scheduled} habits)</p><h2>Habits</h2><table><thead><tr><th>Habit</th><th>Status</th><th>Target</th><th>Habit Note</th></tr></thead><tbody>${habitsHtml || '<tr><td colspan="4">No habits scheduled</td></tr>'}</tbody></table><h2>Journal</h2><div class="journal">${journalHtml}</div></body></html>`;

    const opened = safeOpenPrintWindow(html, `ReflectFlow ${dateKey}`, {
      onBlocked: () => toast('Print window was blocked. Please allow popups and try again.', 'warning', 5500),
      onError: () => toast('Could not prepare the print report. Please try again.', 'error')
    });
    console.info('ReflectFlow print report requested:', { opened, date: dateKey, habits: state.habits.length, scheduled: stats.scheduled });
  } catch (error) {
    console.warn('ReflectFlow print report failed before opening popup:', error);
    toast('Could not prepare the print report. Please try again.', 'error');
  }
}
