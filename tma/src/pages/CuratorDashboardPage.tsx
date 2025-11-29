import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './CuratorDashboardPage.css';

interface Learner {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  enrollments: Array<{
    id: string;
    module: {
      id: string;
      index: number;
      title: string;
    };
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  }>;
  totalSubmissions: number;
  pendingSubmissions: number;
}

export function CuratorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLearners = async () => {
      try {
        setLoading(true);
        const response = await api.get('/admin/learners');
        setLearners(response.data);
      } catch (err: any) {
        console.error('Failed to load learners:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки участников');
      } finally {
        setLoading(false);
      }
    };

    loadLearners();
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Ученики</h1>
        <p className="page-subtitle">Добро пожаловать, {user?.firstName}!</p>
      </div>

        <div className="learners-list">
          <h2 className="section-title">Участники ({learners.length}):</h2>
          {learners.length === 0 ? (
            <div className="empty-state">
              <p>Нет участников</p>
            </div>
          ) : (
            learners.map((learner) => {
              const userName = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Без имени';
              const inProgressModules = learner.enrollments.filter((e) => e.status === 'IN_PROGRESS').length;
              const completedModules = learner.enrollments.filter((e) => e.status === 'COMPLETED').length;

              return (
                <div
                  key={learner.id}
                  className="card learner-card"
                  onClick={() => navigate(`/curator/users/${learner.id}`)}
                >
                  <div className="card-title">{userName}</div>
                  {learner.position && (
                    <div className="card-subtitle">{learner.position}</div>
                  )}
                  <div className="learner-stats">
                    <div className="stat-item">
                      <span className="stat-label">Модули:</span>
                      <span className="stat-value">
                        {completedModules} завершено, {inProgressModules} в процессе
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Сдач:</span>
                      <span className="stat-value">
                        {learner.totalSubmissions} всего, {learner.pendingSubmissions} на проверке
                      </span>
                    </div>
                  </div>
                  {learner.pendingSubmissions > 0 && (
                    <div className="pending-badge">
                      {learner.pendingSubmissions} на проверке
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
    </div>
  );
}

