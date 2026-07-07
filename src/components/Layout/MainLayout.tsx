import { useState } from 'react';
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

export default function MainLayout() {
  const { toast, createOpen, genItinOpen, connectOpen, invoiceOpen } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((v) => !v);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="main-layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      <div className="main-layout__content">
        <Topbar onToggleSidebar={toggleSidebar} />
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
