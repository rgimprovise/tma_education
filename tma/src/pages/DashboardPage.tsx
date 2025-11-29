import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './DashboardPage.css';

interface ModuleWithProgress {
  id: string;
  index: number;
  title: string;
  description?: string;
  enrollment: {
    id: string;
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
    unlockedAt?: string;
    completedAt?: string;
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [currentModule, setCurrentModule] = useState<ModuleWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Загружаем модули с прогрессом
        const modulesResponse = await api.get('/course/modules');
        setModules(modulesResponse.data);

        // Загружаем текущий модуль для кнопки "Продолжить"
        const currentResponse = await api.get('/course/current');
        setCurrentModule(currentResponse.data);
      } catch (err: any) {
        console.error('Failed to load modules:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleContinue = () => {
    if (currentModule) {
      navigate(`/modules/${currentModule.id}`);
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

  const userName = user?.firstName || 'Участник';

  // Проверяем, есть ли у пользователя хотя бы один открытый или завершённый модуль
  const hasAccessibleModules = modules.some(
    (m) => m.enrollment.status === 'IN_PROGRESS' || m.enrollment.status === 'COMPLETED'
  );

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Добро пожаловать, {userName}!</h1>
        <p className="page-subtitle">Ваш прогресс по модулям</p>
      </div>

      {!hasAccessibleModules ? (
        // Заглушка, если нет доступных модулей
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <h2 className="empty-state-title">Модули пока не открыты</h2>
          <p className="empty-state-description">
            Пока для вас не открыт ни один модуль.
            <br />
            Куратор откроет первый модуль, когда начнётся обучение.
          </p>
          <div className="empty-state-hint">
            <p>Вы получите уведомление в Telegram, когда модуль будет открыт.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="modules-list">
            {modules.map((module) => (
              <div
                key={module.id}
                className={`card ${module.enrollment.status === 'LOCKED' ? 'card-disabled' : ''}`}
                onClick={() => {
                  if (module.enrollment.status !== 'LOCKED') {
                    navigate(`/modules/${module.id}`);
                  }
                }}
              >
                <div className="card-title">
                  Модуль {module.index}: {module.title}
                </div>
                {module.description && (
                  <div className="card-subtitle">{module.description}</div>
                )}
                <div className={`card-status ${getStatusClass(module.enrollment.status)}`}>
                  {getStatusLabel(module.enrollment.status)}
                </div>
              </div>
            ))}
          </div>

          {currentModule && currentModule.enrollment.status === 'IN_PROGRESS' && (
            <button className="btn btn-primary" onClick={handleContinue}>
              ▶️ Продолжить обучение
            </button>
          )}

          {!currentModule && (
            <div className="text-center mt-16">
              <p className="page-subtitle">
                Ждите открытия модуля куратором
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

