import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { StudentDashboard } from './pages/StudentDashboard';
import { ExamInstructions } from './pages/ExamInstructions';
import { ExamInterface } from './pages/ExamInterface';
import { AdminDashboard } from './pages/AdminDashboard';

// Route Guard for authenticated users
const RequireAuth: React.FC<{ children: React.ReactNode; allowedRole?: 'student' | 'admin' }> = ({ children, allowedRole }) => {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <>{children}</>;
};

// Root redirect logic
const RootRedirect: React.FC = () => {
  const { user, token } = useAuth();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student Secured Routes */}
          <Route 
            path="/dashboard" 
            element={
              <RequireAuth allowedRole="student">
                <StudentDashboard />
              </RequireAuth>
            } 
          />
          <Route 
            path="/exams/:examId" 
            element={
              <RequireAuth allowedRole="student">
                <ExamInstructions />
              </RequireAuth>
            } 
          />
          <Route 
            path="/exams/:examId/interface" 
            element={
              <RequireAuth allowedRole="student">
                <ExamInterface />
              </RequireAuth>
            } 
          />

          {/* Admin Secured Routes */}
          <Route 
            path="/admin" 
            element={
              <RequireAuth allowedRole="admin">
                <AdminDashboard />
              </RequireAuth>
            } 
          />

          {/* Root Fallbacks */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
