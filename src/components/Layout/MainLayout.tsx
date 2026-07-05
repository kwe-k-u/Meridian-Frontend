import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useApp } from '../../contexts/AppContext';
import Toast from '../Toast';
import CreateTripModal from '../modals/CreateTripModal';
import ConnectChannelModal from '../modals/ConnectChannelModal';
import InvoiceDetailModal from '../modals/InvoiceDetailModal';
import GenerateItineraryModal from '../modals/GenerateItineraryModal';
import '../../styles/MainLayout.css';

// ── MainLayout ──────────────────────────────────────────────
// Purpose: Wraps authenticated app pages with Sidebar, Topbar, and renders modals/toast from context.
// Props: none (uses Outlet for nested routes)
export default function MainLayout() {
  const { toast, createOpen, genItinOpen, connectOpen, invoiceOpen } = useApp();

  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-layout__content">
        <Topbar />
        <div className="main-layout__body">
          <Outlet />
        </div>
      </div>
      {createOpen && <CreateTripModal />}
      {genItinOpen && <GenerateItineraryModal />}
      {connectOpen && <ConnectChannelModal />}
      {invoiceOpen && <InvoiceDetailModal />}
      {toast && <Toast />}
    </div>
  );
}
