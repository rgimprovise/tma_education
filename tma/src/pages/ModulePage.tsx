import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './ModulePage.css';

interface Step {
  id: string;
  index: number;
  type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
  title: string;
  content: string;
  maxScore: number;
  submission?: {
    id: string;
    status: string;
    aiScore?: number;
    curatorScore?: number;
  };
}

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [moduleInfo, setModuleInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Загружаем информацию о модуле
        const moduleResponse = await api.get(`/course/modules/${moduleId}`);
        setModuleInfo(moduleResponse.data);

        // Загружаем шаги модуля с прогрессом
        const stepsResponse = await api.get(`/course/modules/${moduleId}/steps`);
        setSteps(stepsResponse.data);
      } catch (err: any) {
        console.error('Failed to load module:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки модуля');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [moduleId]);

  const getStepTypeLabel = (type: string) => {
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

  const getStepStatus = (step: Step) => {
    if (!step.submission) {
      return { label: 'Не начато', class: 'step-status-not-started' };
    }
    
    switch (step.submission.status) {
      case 'SENT':
        return { label: 'Отправлено', class: 'step-status-sent' };
      case 'AI_REVIEWED':
        return { label: 'На проверке', class: 'step-status-reviewing' };
      case 'CURATOR_APPROVED':
        return { label: 'Зачтено', class: 'step-status-approved' };
      case 'CURATOR_RETURNED':
        return { label: 'Возвращено', class: 'step-status-returned' };
      default:
        return { label: step.submission.status, class: '' };
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
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Назад
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{moduleInfo?.title || 'Модуль'}</h1>
        {moduleInfo?.description && (
          <p className="page-subtitle">{moduleInfo.description}</p>
        )}
      </div>

      <div className="steps-list">
        <h2 className="section-title">Шаги модуля:</h2>
        {steps.map((step) => {
          const status = getStepStatus(step);
          return (
            <div
              key={step.id}
              className="card step-card"
              onClick={() => navigate(`/steps/${step.id}`)}
            >
              <div className="card-title">
                {step.index}. {step.title}
              </div>
              <div className="card-subtitle">
                {getStepTypeLabel(step.type)}
              </div>
              {step.submission && (
                <div className="step-submission-info">
                  <div className={`card-status ${status.class}`}>
                    {status.label}
                  </div>
                  {step.submission.aiScore !== null && step.submission.aiScore !== undefined && (
                    <div className="step-score">
                      Оценка ИИ: {step.submission.aiScore}/{step.maxScore}
                    </div>
                  )}
                  {step.submission.curatorScore !== null && step.submission.curatorScore !== undefined && (
                    <div className="step-score">
                      Оценка куратора: {step.submission.curatorScore}/{step.maxScore}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
        ← Назад к модулям
      </button>
    </div>
  );
}

