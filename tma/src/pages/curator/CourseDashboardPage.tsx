import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CourseDashboardPage.css';

interface CourseModule {
  id: string;
  index: number;
  title: string;
  description?: string;
  isExam: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CourseStats {
  totalSteps: number;
  requiredSteps: number;
  moduleId: string;
  totalLearners: number;
  inProgressLearners: number;
  completedLearners: number;
  submissionsTotal: number;
  submissionsOnReview: number;
}

export function CourseDashboardPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  
  const [module, setModule] = useState<CourseModule | null>(null);
  const [stats, setStats] = useState<CourseStats>({
    totalSteps: 0,
    requiredSteps: 0,
    moduleId: '',
    totalLearners: 0,
    inProgressLearners: 0,
    completedLearners: 0,
    submissionsTotal: 0,
    submissionsOnReview: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (moduleId) {
      loadCourseData();
    }
  }, [moduleId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      
      // Загружаем информацию о модуле
      const moduleResponse = await api.get(`/admin/course/modules/${moduleId}`);
      setModule(moduleResponse.data);

      // Загружаем шаги модуля для подсчёта обязательных шагов
      const stepsResponse = await api.get(`/admin/course/modules/${moduleId}/steps`);
      const stepsData = stepsResponse.data;

      // Загружаем статистику по модулю с backend
      const statsResponse = await api.get(`/admin/course/modules/${moduleId}/stats`);
      const backendStats = statsResponse.data;

      // Объединяем данные
      const stats: CourseStats = {
        totalSteps: stepsData.length,
        requiredSteps: stepsData.filter((s: any) => s.isRequired).length,
        moduleId: backendStats.moduleId,
        totalLearners: backendStats.totalLearners,
        inProgressLearners: backendStats.inProgressLearners,
        completedLearners: backendStats.completedLearners,
        submissionsTotal: backendStats.submissionsTotal,
        submissionsOnReview: backendStats.submissionsOnReview,
      };

      setStats(stats);
    } catch (err: any) {
      console.error('Failed to load course data:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки данных курса');
    } finally {
      setLoading(false);
    }
  };

  const handleManageLearners = () => {
    // Переход на список обучающихся с фильтром по этому модулю
    navigate(`/curator/courses/${moduleId}/learners`);
  };

  const handleEditCourse = () => {
    // Переход в редактор модуля
    navigate(`/curator/course/modules/${moduleId}`);
  };

  const handleBackToCourses = () => {
    navigate('/curator/courses');
  };

  if (loading) {
    return (
      <div className="course-dashboard">
        <div className="loading">Загрузка данных курса...</div>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="course-dashboard">
        <button className="btn-back" onClick={handleBackToCourses}>
          ← Назад к списку курсов
        </button>
        <div className="error">{error || 'Курс не найден'}</div>
      </div>
    );
  }

  return (
    <div className="course-dashboard">
      <button className="btn-back" onClick={handleBackToCourses}>
        ← Назад к списку курсов
      </button>

      <div className="course-header">
        <div className="course-header-main">
          <h1 className="course-title">
            {module.isExam ? '🎓' : '📖'} {module.title}
          </h1>
          <div className="course-meta">
            <span className="course-badge">Модуль {module.index}</span>
            {module.isExam && <span className="course-badge exam">Экзамен</span>}
          </div>
        </div>
        {module.description && (
          <p className="course-description">{module.description}</p>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSteps}</div>
            <div className="stat-label">Всего шагов</div>
            {stats.requiredSteps > 0 && (
              <div className="stat-hint">{stats.requiredSteps} обязательных</div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalLearners}</div>
            <div className="stat-label">Участников</div>
            {stats.totalLearners > 0 && (
              <div className="stat-hint">
                {stats.inProgressLearners} в процессе, {stats.completedLearners} завершили
              </div>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">
              {stats.totalLearners > 0 
                ? `${Math.round((stats.completedLearners / stats.totalLearners) * 100)}%`
                : '—'
              }
            </div>
            <div className="stat-label">Прогресс</div>
            <div className="stat-hint">Процент завершивших</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-value">{stats.submissionsTotal}</div>
            <div className="stat-label">Сдачи</div>
            {stats.submissionsOnReview > 0 && (
              <div className="stat-hint">
                {stats.submissionsOnReview} на проверке
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="actions-section">
        <h2 className="section-title">Действия</h2>
        <div className="actions-grid">
          <button className="action-card" onClick={handleManageLearners}>
            <div className="action-icon">👥</div>
            <div className="action-content">
              <h3 className="action-title">Управлять участниками</h3>
              <p className="action-description">
                Просмотр списка участников, открытие доступа к курсу
              </p>
            </div>
            <div className="action-arrow">→</div>
          </button>

          <button className="action-card" onClick={handleEditCourse}>
            <div className="action-icon">✏️</div>
            <div className="action-content">
              <h3 className="action-title">Редактировать курс</h3>
              <p className="action-description">
                Изменить название, описание, добавить или удалить шаги
              </p>
            </div>
            <div className="action-arrow">→</div>
          </button>
        </div>
      </div>

      <div className="course-info-section">
        <h2 className="section-title">Дополнительная информация</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Создан:</span>
            <span className="info-value">
              {new Date(module.createdAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Обновлён:</span>
            <span className="info-value">
              {new Date(module.updatedAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

