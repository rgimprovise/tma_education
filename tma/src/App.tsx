import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CuratorLayout } from './components/CuratorLayout';
import { useTheme } from './hooks/useTheme';
import { DashboardPage } from './pages/DashboardPage';
import { ModulePage } from './pages/ModulePage';
import { StepPage } from './pages/StepPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { LoginPage } from './pages/LoginPage';
import { IncompleteProfilePage } from './pages/IncompleteProfilePage';
import { CuratorCoursesDashboardPage } from './pages/curator/CuratorCoursesDashboardPage';
import { CourseDashboardPage } from './pages/curator/CourseDashboardPage';
import { CuratorDashboardPage } from './pages/CuratorDashboardPage';
import { CuratorUserPage } from './pages/CuratorUserPage';
import { CourseBuilderPage } from './pages/CourseBuilderPage';
import { CourseModuleEditorPage } from './pages/CourseModuleEditorPage';
import { CourseStepsPage } from './pages/CourseStepsPage';
import { CourseStepEditorPage } from './pages/CourseStepEditorPage';
import './theme/theme.css';
import './App.css';

function App() {
  const [isReady, setIsReady] = useState(false);
  
  // Инициализация темы приложения
  useTheme();

  useEffect(() => {
    // Инициализация Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Настройка темы Telegram
      tg.setHeaderColor(tg.themeParams.bg_color || '#f7fafc');
      tg.setBackgroundColor(tg.themeParams.bg_color || '#f7fafc');
    } else {
      // Для разработки вне Telegram
      console.warn('Telegram WebApp not available. Running in dev mode.');
    }
    
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="loading">
        <div>Загрузка...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Главная страница - редирект на login для автоавторизации */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/incomplete-profile" element={<IncompleteProfilePage />} />
          
          {/* Роуты для обучающихся */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/modules/:moduleId"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <ModulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/steps/:stepId"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <StepPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/submissions"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <SubmissionsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Роуты для кураторов - обёрнуты в CuratorLayout с табами */}
          <Route
            path="/curator/courses"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CuratorCoursesDashboardPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/courses/:moduleId"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CourseDashboardPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/courses/:moduleId/learners"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CuratorDashboardPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CuratorDashboardPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/users/:userId"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CuratorUserPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Роуты для конструктора курса */}
          <Route
            path="/curator/course"
            element={
              <ProtectedRoute allowedRoles={['CURATOR', 'ADMIN']}>
                <CuratorLayout>
                  <CourseBuilderPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/course/modules/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CuratorLayout>
                  <CourseModuleEditorPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/course/modules/:moduleId"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CuratorLayout>
                  <CourseModuleEditorPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/course/modules/:moduleId/steps"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CuratorLayout>
                  <CourseStepsPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/course/modules/:moduleId/steps/new"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CuratorLayout>
                  <CourseStepEditorPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/curator/course/modules/:moduleId/steps/:stepId"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CuratorLayout>
                  <CourseStepEditorPage />
                </CuratorLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

