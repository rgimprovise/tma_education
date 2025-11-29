import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CuratorSubmissionPage.css';

interface Submission {
  id: string;
  answerText?: string;
  answerFileId?: string;
  answerType: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  aiScore?: number;
  aiFeedback?: string;
  curatorScore?: number;
  curatorFeedback?: string;
  status: 'SENT' | 'AI_REVIEWED' | 'CURATOR_APPROVED' | 'CURATOR_RETURNED';
  resubmissionRequested: boolean;
  resubmissionRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    position?: string;
  };
  module: {
    id: string;
    index: number;
    title: string;
  };
  step: {
    id: string;
    title: string;
    index: number;
    type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
    content: string;
    maxScore: number;
    formSchema?: {
      fields: Array<{
        id: string;
        label: string;
        type: string;
        required: boolean;
      }>;
    };
    expectedAnswer: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  };
}

export function CuratorSubmissionPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [curatorScore, setCuratorScore] = useState<number | ''>('');
  const [curatorFeedback, setCuratorFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!submissionId) return;

    const loadSubmission = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/admin/submissions/${submissionId}`);
        setSubmission(response.data);

        // Предзаполнить поля, если куратор уже выставлял оценку
        if (response.data.curatorScore !== null && response.data.curatorScore !== undefined) {
          setCuratorScore(response.data.curatorScore);
        }
        if (response.data.curatorFeedback) {
          setCuratorFeedback(response.data.curatorFeedback);
        }
      } catch (err) {
        console.error('Failed to load submission:', err);
        setError('Не удалось загрузить сдачу');
      } finally {
        setLoading(false);
      }
    };

    loadSubmission();
  }, [submissionId]);

  const handleApprove = async () => {
    if (!submission) return;

    // Валидация
    if (curatorScore === '' || curatorScore === undefined) {
      alert('Введите оценку для одобрения работы');
      return;
    }

    if (curatorScore < 0 || curatorScore > submission.step.maxScore) {
      alert(`Оценка должна быть от 0 до ${submission.step.maxScore}`);
      return;
    }

    try {
      setProcessing(true);
      await api.post(`/admin/submissions/${submission.id}/approve`, {
        curatorScore,
        curatorFeedback: curatorFeedback.trim() || undefined,
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Работа одобрена!', () => {
          navigate(-1); // Вернуться назад
        });
      } else {
        alert('✅ Работа одобрена!');
        navigate(-1);
      }
    } catch (err: any) {
      console.error('Failed to approve submission:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при одобрении';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!submission) return;

    // Валидация
    if (!curatorFeedback.trim()) {
      alert('Введите комментарий для возврата работы на доработку');
      return;
    }

    try {
      setProcessing(true);
      await api.post(`/admin/submissions/${submission.id}/return`, {
        curatorFeedback: curatorFeedback.trim(),
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('🔄 Работа возвращена на доработку', () => {
          navigate(-1);
        });
      } else {
        alert('🔄 Работа возвращена на доработку');
        navigate(-1);
      }
    } catch (err: any) {
      console.error('Failed to return submission:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при возврате';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!submission) return;

    // Подтверждение
    const userName = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() || 'Ученик';
    const confirmMessage = 
      `Удалить сдачу задания?\n\n` +
      `Ученик: ${userName}\n` +
      `Модуль: ${submission.module.title}\n` +
      `Шаг: ${submission.step.title}\n\n` +
      `Ученик сможет выполнить задание заново.`;

    const confirmed = window.Telegram?.WebApp 
      ? await new Promise<boolean>((resolve) => {
          window.Telegram?.WebApp?.showConfirm(confirmMessage, (result) => {
            resolve(result);
          });
        })
      : window.confirm(confirmMessage);

    if (!confirmed) return;

    try {
      setProcessing(true);
      await api.post(`/admin/submissions/${submission.id}/delete`);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('🗑️ Сдача удалена. Ученик может выполнить задание заново.', () => {
          navigate(-1);
        });
      } else {
        alert('🗑️ Сдача удалена');
        navigate(-1);
      }
    } catch (err: any) {
      console.error('Failed to delete submission:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при удалении';
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const renderAnswerContent = () => {
    if (!submission) return null;

    // Если есть formSchema — парсим ответ
    if (submission.step.formSchema && submission.answerText) {
      try {
        const answersObj = JSON.parse(submission.answerText);
        return (
          <div className="form-answers">
            {submission.step.formSchema.fields.map((field) => (
              <div key={field.id} className="form-answer-item">
                <div className="form-answer-label">{field.label}:</div>
                <div className="form-answer-value">
                  {answersObj[field.id] || '(не заполнено)'}
                </div>
              </div>
            ))}
          </div>
        );
      } catch (err) {
        // Если не удалось распарсить — показываем как текст
        return (
          <div className="answer-text">
            {submission.answerText}
          </div>
        );
      }
    }

    // Обычный текстовый ответ
    if (submission.answerText) {
      return (
        <div className="answer-text">
          {submission.answerText}
        </div>
      );
    }

    // Файл/аудио/видео
    if (submission.answerFileId) {
      const isAudioVideo = submission.answerType === 'AUDIO' || submission.answerType === 'VIDEO';
      const audioUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/audio-submissions/play/${submission.answerFileId}`;
      
      return (
        <div className="answer-file">
          <div className="answer-type-badge">
            {submission.answerType === 'AUDIO' ? '🎤 Голосовое сообщение' :
             submission.answerType === 'VIDEO' ? '📹 Видео-кружок' :
             `📎 Файл (${submission.answerType})`}
          </div>
          
          {isAudioVideo && submission.answerText && (
            <div className="transcription-block">
              <div className="transcription-title">📝 Транскрипт:</div>
              <div className="transcription-text">{submission.answerText}</div>
            </div>
          )}
          
          {isAudioVideo && (
            <button
              className="btn btn-play-audio"
              onClick={() => window.open(audioUrl, '_blank')}
            >
              🎧 Прослушать аудио
            </button>
          )}
          
          {!isAudioVideo && (
            <div className="file-info">
              <p>File ID: <code>{submission.answerFileId}</code></p>
              <p className="hint">Для просмотра файла обратитесь к Telegram API</p>
            </div>
          )}
        </div>
      );
    }

    return <div className="empty-answer">Ответ отсутствует</div>;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container">
        <div className="error">{error || 'Сдача не найдена'}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Назад
        </button>
      </div>
    );
  }

  const userName = `${submission.user.firstName || ''} ${submission.user.lastName || ''}`.trim() || 'Без имени';
  const isFinalized = submission.status === 'CURATOR_APPROVED' || submission.status === 'CURATOR_RETURNED';

  return (
    <div className="container curator-submission-page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        ← Назад к ученику
      </button>

      {/* Заголовок */}
      <div className="page-header">
        <h1 className="page-title">Проверка работы</h1>
      </div>

      {/* Информация о сдаче */}
      <div className="card submission-info-card">
        <div className="info-row">
          <span className="info-label">Ученик:</span>
          <span className="info-value">{userName}</span>
        </div>
        {submission.user.position && (
          <div className="info-row">
            <span className="info-label">Должность:</span>
            <span className="info-value">{submission.user.position}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Модуль:</span>
          <span className="info-value">
            Модуль {submission.module.index}: {submission.module.title}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Шаг:</span>
          <span className="info-value">
            Шаг {submission.step.index}: {submission.step.title}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Статус:</span>
          <span className={`status-badge status-${submission.status.toLowerCase()}`}>
            {submission.status === 'SENT' && '📤 Отправлено'}
            {submission.status === 'AI_REVIEWED' && '🤖 Проверено ИИ'}
            {submission.status === 'CURATOR_APPROVED' && '✅ Одобрено'}
            {submission.status === 'CURATOR_RETURNED' && '🔄 Возвращено'}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Дата отправки:</span>
          <span className="info-value">
            {new Date(submission.createdAt).toLocaleString('ru-RU')}
          </span>
        </div>
        {submission.resubmissionRequested && (
          <div className="resubmission-notice">
            🔄 Ученик запросил повторную отправку
          </div>
        )}
      </div>

      {/* Задание */}
      <div className="card">
        <h2 className="section-title">Задание</h2>
        <div className="task-content">{submission.step.content}</div>
      </div>

      {/* Ответ ученика */}
      <div className="card">
        <h2 className="section-title">Ответ ученика</h2>
        {renderAnswerContent()}
      </div>

      {/* Оценка ИИ */}
      {(submission.aiScore !== null && submission.aiScore !== undefined) && (
        <div className="card ai-review-card">
          <h2 className="section-title">🤖 Оценка ИИ</h2>
          <div className="ai-score">
            Оценка: {submission.aiScore}/{submission.step.maxScore}
          </div>
          {submission.aiFeedback && (
            <div className="ai-feedback">
              <div className="feedback-label">Комментарий ИИ:</div>
              <div className="feedback-text">{submission.aiFeedback}</div>
            </div>
          )}
        </div>
      )}

      {/* Решение куратора */}
      {!isFinalized && (
        <div className="card curator-decision-card">
          <h2 className="section-title">Ваше решение</h2>
          
          <div className="form-group">
            <label className="form-label">
              Оценка (от 0 до {submission.step.maxScore}):
            </label>
            <input
              type="number"
              className="form-input"
              value={curatorScore}
              onChange={(e) => {
                const value = e.target.value;
                setCuratorScore(value === '' ? '' : Number(value));
              }}
              min={0}
              max={submission.step.maxScore}
              placeholder="Введите оценку"
              disabled={processing}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Комментарий (необязательно):</label>
            <textarea
              className="form-textarea"
              value={curatorFeedback}
              onChange={(e) => setCuratorFeedback(e.target.value)}
              placeholder="Ваш комментарий к работе..."
              rows={4}
              disabled={processing}
            />
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleApprove}
              disabled={processing}
            >
              {processing ? 'Обработка...' : '✅ Одобрить'}
            </button>
            <button
              className="btn btn-danger"
              onClick={handleReturn}
              disabled={processing}
            >
              {processing ? 'Обработка...' : '🔄 Вернуть на доработку'}
            </button>
          </div>
        </div>
      )}

      {/* Если уже проверено */}
      {isFinalized && (
        <div className="card finalized-card">
          <h2 className="section-title">Результат проверки</h2>
          {submission.curatorScore !== null && submission.curatorScore !== undefined && (
            <div className="curator-score">
              Оценка куратора: {submission.curatorScore}/{submission.step.maxScore}
            </div>
          )}
          {submission.curatorFeedback && (
            <div className="curator-feedback">
              <div className="feedback-label">Комментарий куратора:</div>
              <div className="feedback-text">{submission.curatorFeedback}</div>
            </div>
          )}
        </div>
      )}

      {/* Кнопка удаления сдачи - всегда доступна */}
      <div className="card danger-zone-card">
        <h3 className="section-title danger-title">⚠️ Опасная зона</h3>
        <p className="danger-description">
          Удаление сдачи сбросит весь прогресс ученика по этому заданию.
          Ученик сможет выполнить задание заново.
        </p>
        <button
          className="btn btn-delete"
          onClick={handleDelete}
          disabled={processing}
        >
          {processing ? 'Удаление...' : '🗑️ Удалить сдачу'}
        </button>
      </div>
    </div>
  );
}

