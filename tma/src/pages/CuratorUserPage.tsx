import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './CuratorUserPage.css';

interface Enrollment {
  id: string;
  module: {
    id: string;
    index: number;
    title: string;
    description?: string;
  };
  status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  unlockedAt?: string;
  completedAt?: string;
  unlockedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

interface Submission {
  id: string;
  step: {
    id: string;
    title: string;
    index: number;
    maxScore: number;
  };
  module: {
    id: string;
    index: number;
    title: string;
  };
  status: string;
  answerText?: string;
  aiScore?: number;
  aiFeedback?: string;
  curatorScore?: number;
  curatorFeedback?: string;
  resubmissionRequested: boolean;
  resubmissionRequestedAt?: string;
  createdAt: string;
}

interface LearnerDetail {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  enrollments: Enrollment[];
  recentSubmissions: Submission[];
  statistics: {
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    returnedSubmissions: number;
  };
}

export function CuratorUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [learner, setLearner] = useState<LearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const loadLearnerDetail = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/learners/${userId}`);
        setLearner(response.data);
      } catch (err: any) {
        console.error('Failed to load learner detail:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки данных участника');
      } finally {
        setLoading(false);
      }
    };

    loadLearnerDetail();
  }, [userId]);

  const handleUnlockModule = async (moduleId: string, moduleIndex: number) => {
    if (!userId) return;

    try {
      setUnlocking(moduleId);
      
      await api.post(`/admin/modules/${moduleId}/unlock`, {
        userIds: [userId],
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `✅ Модуль ${moduleIndex} открыт для участника`
        );
      } else {
        alert(`✅ Модуль ${moduleIndex} открыт для участника`);
      }

      // Перезагружаем данные
      const detailResponse = await api.get(`/admin/learners/${userId}`);
      setLearner(detailResponse.data);
    } catch (err: any) {
      console.error('Failed to unlock module:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при открытии модуля';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setUnlocking(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'LOCKED':
        return '🔒 Заблокирован';
      case 'IN_PROGRESS':
        return '📚 В процессе';
      case 'COMPLETED':
        return '✅ Завершён';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'LOCKED':
        return 'status-locked';
      case 'IN_PROGRESS':
        return 'status-in-progress';
      case 'COMPLETED':
        return 'status-completed';
      default:
        return '';
    }
  };

  const handleDeleteUser = async () => {
    if (!userId || !learner) return;

    const userName = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Ученик';
    const confirmMessage = 
      `Удалить пользователя?\n\n` +
      `Имя: ${userName}\n` +
      `Telegram ID: ${learner.telegramId}\n\n` +
      `Будут удалены:\n` +
      `- Все enrollments (прогресс по модулям)\n` +
      `- Все submissions (сдачи заданий)\n\n` +
      `Это действие нельзя отменить!`;

    const confirmed = window.Telegram?.WebApp 
      ? await new Promise<boolean>((resolve) => {
          window.Telegram?.WebApp?.showConfirm(confirmMessage, (result) => {
            resolve(result);
          });
        })
      : window.confirm(confirmMessage);

    if (!confirmed) return;

    try {
      setDeleting(true);
      await api.delete(`/admin/users/${userId}`);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Пользователь удалён', () => {
          navigate('/curator');
        });
      } else {
        alert('✅ Пользователь удалён');
        navigate('/curator');
      }
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при удалении пользователя';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error || !learner) {
    return (
      <div className="container">
        <div className="error">{error || 'Участник не найден'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/curator')}>
          ← Назад
        </button>
      </div>
    );
  }

  const userName = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Без имени';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{userName}</h1>
          {learner.position && (
            <p className="page-subtitle">{learner.position}</p>
          )}
        </div>
        <button
          className="btn btn-danger"
          onClick={handleDeleteUser}
          disabled={deleting}
          title="Удалить пользователя"
        >
          {deleting ? '🔄 Удаляю...' : '🗑️ Удалить'}
        </button>
      </div>

      {/* Статистика */}
      <div className="stats-section">
        <h2 className="section-title">Статистика</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{learner.statistics.totalSubmissions}</div>
            <div className="stat-label">Всего сдач</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{learner.statistics.approvedSubmissions}</div>
            <div className="stat-label">Одобрено</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-value-warning">{learner.statistics.pendingSubmissions}</div>
            <div className="stat-label">На проверке</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-value-error">{learner.statistics.returnedSubmissions}</div>
            <div className="stat-label">Возвращено</div>
          </div>
        </div>
      </div>

      {/* Прогресс по модулям */}
      <div className="modules-section">
        <h2 className="section-title">Прогресс по модулям</h2>
        {learner.enrollments.length === 0 ? (
          <div className="empty-state">Нет модулей</div>
        ) : (
          learner.enrollments.map((enrollment) => (
            <div key={enrollment.id} className="card enrollment-card">
              <div className="card-title">
                {enrollment.module.title}
              </div>
              {enrollment.module.description && (
                <div className="card-subtitle">{enrollment.module.description}</div>
              )}
              <div className={`card-status ${getStatusClass(enrollment.status)}`}>
                {getStatusLabel(enrollment.status)}
              </div>
              {enrollment.status === 'LOCKED' && (
                <button
                  className="btn btn-primary btn-small"
                  onClick={() => handleUnlockModule(enrollment.module.id, enrollment.module.index)}
                  disabled={unlocking === enrollment.module.id}
                >
                  {unlocking === enrollment.module.id ? 'Открытие...' : `Открыть модуль ${enrollment.module.index}`}
                </button>
              )}
              {enrollment.unlockedAt && (
                <div className="enrollment-meta">
                  Открыт: {new Date(enrollment.unlockedAt).toLocaleDateString('ru-RU')}
                </div>
              )}
              {enrollment.completedAt && (
                <div className="enrollment-meta">
                  Завершён: {new Date(enrollment.completedAt).toLocaleDateString('ru-RU')}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Последние сдачи */}
      <div className="submissions-section">
        <h2 className="section-title">Последние сдачи</h2>
        {learner.recentSubmissions.length === 0 ? (
          <div className="empty-state">Нет сдач</div>
        ) : (
          learner.recentSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="card submission-card clickable"
              onClick={() => navigate(`/curator/submissions/${submission.id}`)}
            >
              <div className="card-title">
                Модуль {submission.module.index}, Шаг {submission.step.index}: {submission.step.title}
              </div>
              <div className="card-subtitle">
                Статус: {submission.status}
              </div>
              {submission.resubmissionRequested && (
                <div className="resubmission-request-badge">
                  🔄 Запрос на повторную отправку
                </div>
              )}
              {submission.aiScore !== null && submission.aiScore !== undefined && (
                <div className="submission-score">
                  Оценка ИИ: {submission.aiScore}/{submission.step.maxScore}
                </div>
              )}
              {submission.curatorScore !== null && submission.curatorScore !== undefined && (
                <div className="submission-score">
                  Оценка куратора: {submission.curatorScore}/{submission.step.maxScore}
                </div>
              )}
              <div className="submission-date">
                {new Date(submission.createdAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <button className="btn btn-secondary" onClick={() => navigate('/curator')}>
        ← Назад к участникам
      </button>
    </div>
  );
}

