import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CuratorTabs } from '../components/CuratorTabs';
import './CourseBuilderPage.css';

interface CourseModule {
  id: string;
  index: number;
  title: string;
  description?: string;
  isExam: boolean;
  _count?: {
    steps: number;
  };
}

export function CourseBuilderPage() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/course/modules');
      setModules(response.data);
    } catch (err: any) {
      console.error('Failed to load modules:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки модулей');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить модуль? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await api.delete(`/admin/course/modules/${moduleId}`);
      await loadModules();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка при удалении модуля');
    }
  };

  if (loading) {
    return (
      <div>
        <CuratorTabs />
        <div className="container">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <CuratorTabs />
        <div className="container">
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CuratorTabs />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Конструктор курса</h1>
          <p className="page-subtitle">Управление модулями и шагами</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/curator/course/modules/new')}
        >
          ➕ Добавить модуль
        </button>

        <div className="modules-list">
          {modules.length === 0 ? (
            <div className="empty-state">Нет модулей. Создайте первый модуль.</div>
          ) : (
            modules.map((module) => (
              <div
                key={module.id}
                className="card module-card"
                onClick={() => navigate(`/curator/course/modules/${module.id}`)}
              >
                <div className="module-header">
                  <div className="module-title">
                    Модуль {module.index}: {module.title}
                    {module.isExam && <span className="exam-badge">Экзамен</span>}
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(module.id, e)}
                    title="Удалить модуль"
                  >
                    🗑️
                  </button>
                </div>
                {module.description && (
                  <div className="module-description">{module.description}</div>
                )}
                <div className="module-meta">
                  Шагов: {module._count?.steps || 0}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

