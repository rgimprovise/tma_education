import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CuratorTabs } from '../components/CuratorTabs';
import './CourseStepsPage.css';

interface CourseStep {
  id: string;
  index: number;
  title: string;
  type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
  isRequired: boolean;
}

export function CourseStepsPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<CourseStep[]>([]);
  const [moduleTitle, setModuleTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (moduleId) {
      loadSteps();
      loadModule();
    }
  }, [moduleId]);

  const loadModule = async () => {
    try {
      const response = await api.get(`/admin/course/modules/${moduleId}`);
      setModuleTitle(response.data.title);
    } catch (err: any) {
      console.error('Failed to load module:', err);
    }
  };

  const loadSteps = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/course/modules/${moduleId}/steps`);
      setSteps(response.data);
    } catch (err: any) {
      console.error('Failed to load steps:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки шагов');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (stepId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить шаг? Это действие нельзя отменить.')) {
      return;
    }

    try {
      await api.delete(`/admin/course/steps/${stepId}`);
      await loadSteps();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка при удалении шага');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INFO':
        return '📖 Информация';
      case 'TASK':
        return '✍️ Задание';
      case 'QUIZ':
        return '❓ Квиз';
      case 'EXAM':
        return '📝 Экзамен';
      default:
        return type;
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
          <button className="btn btn-secondary" onClick={() => navigate('/curator/course')}>
            ← Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CuratorTabs />
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Шаги модуля</h1>
          <p className="page-subtitle">{moduleTitle}</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate(`/curator/course/modules/${moduleId}/steps/new`)}
        >
          ➕ Добавить шаг
        </button>

        <div className="steps-list">
          {steps.length === 0 ? (
            <div className="empty-state">Нет шагов. Создайте первый шаг.</div>
          ) : (
            steps.map((step) => (
              <div
                key={step.id}
                className="card step-card"
                onClick={() => navigate(`/curator/course/modules/${moduleId}/steps/${step.id}`)}
              >
                <div className="step-header">
                  <div className="step-title">
                    {step.index}. {step.title}
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(step.id, e)}
                    title="Удалить шаг"
                  >
                    🗑️
                  </button>
                </div>
                <div className="step-meta">
                  <span className="step-type">{getTypeLabel(step.type)}</span>
                  {step.isRequired && <span className="required-badge">Обязательный</span>}
                </div>
              </div>
            ))
          )}
        </div>

        <button className="btn btn-secondary" onClick={() => navigate('/curator/course')}>
          ← Назад к модулям
        </button>
      </div>
    </div>
  );
}

