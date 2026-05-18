import { useApp } from '../../context/AppContext';

export default function ToastContainer() {
  const { ui } = useApp();
  return (
    <div id="toast-container" className="toast-container" aria-live="polite">
      {ui.toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type} show`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
