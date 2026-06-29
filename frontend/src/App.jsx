import { Routes, Route, Navigate, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { SpecsProvider } from './context/SpecsContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SpecEditor from './pages/SpecEditor.jsx';
import CoverageReport from './pages/CoverageReport.jsx';

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <Link to="/" className="brand">Spec<span>Gen</span> · Reviewer</Link>
      <div className="row">
        {user && <span className="muted">{user.email}</span>}
        {user && (
          <button onClick={() => { logout(); navigate('/login'); }}>Log out</button>
        )}
      </div>
    </div>
  );
}

/** Layout for the authenticated area: persistent sidebar + routed content. */
function ProtectedLayout() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SpecsProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </SpecsProvider>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/specs/:id" element={<SpecEditor />} />
        </Route>
        {/* Standalone report window (opened in a new tab from the review): no sidebar. */}
        <Route path="/specs/:id/coverage" element={<CoverageReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
