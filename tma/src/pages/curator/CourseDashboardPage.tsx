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

interface Submission {
  id: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  step: {
    id: string;
    title: string;
    index: number;
  };
  status: string;
  aiScore?: number;
  createdAt: string;
}

interface Learner {
  id: string;
  firstName?: string;
  lastName?: string;
  enrollment: {
    status: 'IN_PROGRESS' | 'COMPLETED';
    progress: number;
    totalSteps: number;
  };
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
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
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

      // Загружаем submissions на проверке
      await loadSubmissionsOnReview();

      // Загружаем учеников курса
      await loadCourseLearners();
    } catch (err: any) {
      console.error('Failed to load course data:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки данных курса');
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissionsOnReview = async () => {
    try {
      // Запрашиваем все submissions со статусом SENT или AI_REVIEWED
      const response = await api.get('/admin/submissions', {
        params: {
          moduleId,
          status: 'SENT,AI_REVIEWED',
        },
      });
      // Берём последние 5
      setSubmissions(response.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  const loadCourseLearners = async () => {
    try {
      // Запрашиваем всех learners
      const response = await api.get('/admin/learners');
      const allLearners = response.data;

      // Фильтруем тех, у кого есть enrollment для этого модуля
      const courseLearners = allLearners
        .map((learner: any) => {
          const enrollment = learner.enrollments?.find(
            (e: any) => e.module?.id === moduleId
          );
          if (!enrollment) return null;

          // Подсчитываем прогресс
          const completedSteps = learner.submissions?.filter(
            (s: any) => s.module?.id === moduleId && s.status === 'CURATOR_APPROVED'
          ).length || 0;

          return {
            id: learner.id,
            firstName: learner.firstName,
            lastName: learner.lastName,
            enrollment: {
              status: enrollment.status,
              progress: completedSteps,
              totalSteps: stats.totalSteps,
            },
          };
        })
        .filter(Boolean);

      setLearners(courseLearners);
    } catch (err) {
      console.error('Failed to load learners:', err);
    }
  };

  const handleEditCourse = () => {
    // Переход в редактор модуля
    navigate(`/curator/course/modules/${moduleId}`);
  };

  const handleManageSteps = () => {
    // Переход к списку шагов
    navigate(`/curator/course/modules/${moduleId}/steps`);
  };

  const handleOpenSubmission = (submissionId: string) => {
    // Переход к детальной странице submission (пока переходим к ученику)
    navigate(`/curator/users/${submissionId}`);
  };

  const handleOpenLearner = (learnerId: string) => {
    // Переход к карточке ученика
    navigate(`/curator/users/${learnerId}`);
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
        <div className="course-header-info">
          <span className="header-info-item">
            📝 {stats.totalSteps} {stats.totalSteps === 1 ? 'шаг' : stats.totalSteps < 5 ? 'шага' : 'шагов'}
            {stats.requiredSteps > 0 && `, ${stats.requiredSteps} обязательных`}
          </span>
        </div>
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
          <button className="action-card" onClick={handleEditCourse}>
            <div className="action-icon">✏️</div>
            <div className="action-content">
              <h3 className="action-title">Редактировать курс</h3>
              <p className="action-description">
                Изменить название и описание курса
              </p>
            </div>
            <div className="action-arrow">→</div>
          </button>

          <button className="action-card" onClick={handleManageSteps}>
            <div className="action-icon">📝</div>
            <div className="action-content">
              <h3 className="action-title">Управлять шагами</h3>
              <p className="action-description">
                Добавить, изменить или удалить шаги курса
              </p>
            </div>
            <div className="action-arrow">→</div>
          </button>
        </div>
      </div>

      {/* Блок: Нуждается в проверке */}
      {submissions.length > 0 && (
        <div className="submissions-section">
          <h2 className="section-title">Нуждается в проверке</h2>
          <div className="submissions-list">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="submission-card"
                onClick={() => handleOpenSubmission(submission.user.id)}
              >
                <div className="submission-user">
                  <div className="user-avatar">
                    {(submission.user.firstName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">
                      {submission.user.firstName || 'Без имени'} {submission.user.lastName || ''}
                    </div>
                    <div className="submission-step">
                      Шаг {submission.step.index}: {submission.step.title}
                    </div>
                  </div>
                </div>
                <div className="submission-status">
                  <span className={`status-badge ${submission.status.toLowerCase()}`}>
                    {submission.status === 'SENT' ? 'Отправлено' : 'Проверено ИИ'}
                  </span>
                  {submission.aiScore !== null && submission.aiScore !== undefined && (
                    <span className="ai-score">
                      ИИ: {submission.aiScore}/10
                    </span>
                  )}
                </div>
                <div className="submission-arrow">→</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Блок: Ученики курса */}
      {learners.length > 0 && (
        <div className="learners-section">
          <h2 className="section-title">Ученики курса</h2>
          <div className="learners-list">
            {learners.map((learner) => (
              <div
                key={learner.id}
                className="learner-card"
                onClick={() => handleOpenLearner(learner.id)}
              >
                <div className="learner-info">
                  <div className="learner-avatar">
                    {(learner.firstName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="learner-details">
                    <div className="learner-name">
                      {learner.firstName || 'Без имени'} {learner.lastName || ''}
                    </div>
                    <div className="learner-progress">
                      Прогресс: {learner.enrollment.progress}/{learner.enrollment.totalSteps} шагов
                    </div>
                  </div>
                </div>
                <div className="learner-status">
                  <span className={`status-badge ${learner.enrollment.status.toLowerCase()}`}>
                    {learner.enrollment.status === 'IN_PROGRESS' ? 'В процессе' : 'Завершил'}
                  </span>
                </div>
                <div className="learner-arrow">→</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

