import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from './Topbar';
import AppModals from '../Modals/AppModals';
import { useApp } from '../../context/AppContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export default function AppLayout() {
  const { actions } = useApp();
  useKeyboardShortcuts();
  return (
    <>
      <div className="app" id="app">
        <Sidebar />
        <div className="main-wrapper">
          <Topbar />
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
      <button type="button" className="fab" aria-label="Add habit" title="Add habit" onClick={() => actions.openHabitModal()}>+</button>
      <AppModals />
    </>
  );
}
