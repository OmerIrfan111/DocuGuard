import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import DocumentReview from './pages/DocumentReview.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import ChecklistBuilder from './pages/ChecklistBuilder.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import Settings from './pages/Settings.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/documents/:id" element={<DocumentReview />} />
        <Route path="/checklists" element={<ChecklistBuilder />} />
        <Route path="/audit-logs" element={<ProtectedRoute roles={['admin', 'auditor']}><AuditLogs /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
