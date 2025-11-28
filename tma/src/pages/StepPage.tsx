import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './StepPage.css';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'file';
  required: boolean;
}

interface Step {
  id: string;
  title: string;
  content: string;
  type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
  expectedAnswer: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  formSchema?: {
    fields: FormField[];
  };
  isRequired: boolean;
  module: {
    id: string;
  };
  submission?: {
    id: string;
    status: string;
    answerText?: string;
    aiScore?: number;
    aiFeedback?: string;
    curatorScore?: number;
    curatorFeedback?: string;
  };
}

export function StepPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step | null>(null);
  const [answer, setAnswer] = useState('');
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stepId) return;

    const loadStep = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/course/steps/${stepId}`);
        setStep(response.data);
        
        // Если есть сдача, заполняем ответ
        if (response.data.submission?.answerText) {
          // Пытаемся распарсить как JSON (для динамических форм)
          try {
            const parsed = JSON.parse(response.data.submission.answerText);
            if (typeof parsed === 'object' && parsed !== null) {
              setFormAnswers(parsed);
            } else {
              setAnswer(response.data.submission.answerText);
            }
          } catch {
            // Если не JSON, используем как обычный текст
            setAnswer(response.data.submission.answerText);
          }
        }
      } catch (err: any) {
        console.error('Failed to load step:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки шага');
      } finally {
        setLoading(false);
      }
    };

    loadStep();
  }, [stepId]);

  const handleSubmit = async () => {
    if (!step) return;

    // Проверяем, есть ли динамическая форма
    const hasFormSchema = step.formSchema && step.formSchema.fields && step.formSchema.fields.length > 0;

    if (hasFormSchema) {
      // Валидация обязательных полей
      const requiredFields = step.formSchema!.fields.filter((f) => f.required);
      const missingFields = requiredFields.filter((f) => !formAnswers[f.id]?.trim());
      
      if (missingFields.length > 0) {
        setError(`Заполните обязательные поля: ${missingFields.map((f) => f.label).join(', ')}`);
        return;
      }
    } else {
      // Обычная валидация для простого текстового поля
      if (!answer.trim()) {
        setError('Введите ответ');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      // Формируем answerText: JSON для динамических форм, обычный текст для простых
      const answerText = hasFormSchema
        ? JSON.stringify(formAnswers)
        : answer.trim();

      await api.post('/submissions', {
        stepId: step.id,
        moduleId: step.module.id,
        answerText,
        answerType: step.expectedAnswer || 'TEXT',
      });

      // Показываем уведомление через Telegram WebApp
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Ответ отправлен на проверку!');
      } else {
        alert('✅ Ответ отправлен на проверку!');
      }

      // Возвращаемся к модулю
      navigate(-1);
    } catch (err: any) {
      console.error('Submission error:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при отправке ответа';
      setError(errorMessage);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error && !step) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Назад
        </button>
      </div>
    );
  }

  if (!step) {
    return null;
  }

  const hasSubmission = step.submission !== null && step.submission !== undefined;
  const isApproved = step.submission?.status === 'CURATOR_APPROVED';
  const isReturned = step.submission?.status === 'CURATOR_RETURNED';

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{step.title}</h1>
      </div>

      <div className="step-content">
        <div className="content-text">{step.content}</div>
      </div>

      {step.type === 'TASK' || step.type === 'QUIZ' || step.type === 'EXAM' ? (
        <div className="step-form">
          {step.formSchema && step.formSchema.fields && step.formSchema.fields.length > 0 ? (
            // Динамическая форма по схеме
            <div className="dynamic-form">
              {step.formSchema.fields.map((field) => (
                <div key={field.id} className="form-group">
                  <label className="form-label">
                    {field.label}
                    {field.required && <span className="required-mark"> *</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      value={formAnswers[field.id] || ''}
                      onChange={(e) =>
                        setFormAnswers({ ...formAnswers, [field.id]: e.target.value })
                      }
                      placeholder={`Введите ${field.label.toLowerCase()}...`}
                      disabled={hasSubmission && !isReturned}
                      rows={4}
                    />
                  ) : field.type === 'file' ? (
                    <div className="file-input-hint">
                      <p>Для отправки файла отправьте его боту в Telegram, затем вставьте file_id здесь.</p>
                      <input
                        className="form-input"
                        type="text"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) =>
                          setFormAnswers({ ...formAnswers, [field.id]: e.target.value })
                        }
                        placeholder="file_id из Telegram"
                        disabled={hasSubmission && !isReturned}
                      />
                    </div>
                  ) : (
                    <input
                      className="form-input"
                      type="text"
                      value={formAnswers[field.id] || ''}
                      onChange={(e) =>
                        setFormAnswers({ ...formAnswers, [field.id]: e.target.value })
                      }
                      placeholder={`Введите ${field.label.toLowerCase()}...`}
                      disabled={hasSubmission && !isReturned}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Обычное текстовое поле (fallback)
            <div className="form-group">
              <label className="form-label">Ваш ответ:</label>
              <textarea
                className="form-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Введите ваш ответ..."
                disabled={hasSubmission && !isReturned}
              />
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {hasSubmission && (
            <div className="submission-info">
              <div className="submission-status">
                Статус: {step.submission.status}
              </div>
              {step.submission.aiScore !== null && step.submission.aiScore !== undefined && (
                <div className="feedback-block">
                  <div className="feedback-title">Оценка ИИ: {step.submission.aiScore}/10</div>
                  {step.submission.aiFeedback && (
                    <div className="feedback-text">{step.submission.aiFeedback}</div>
                  )}
                </div>
              )}
              {step.submission.curatorScore !== null && step.submission.curatorScore !== undefined && (
                <div className="feedback-block">
                  <div className="feedback-title">
                    Оценка куратора: {step.submission.curatorScore}/10
                  </div>
                  {step.submission.curatorFeedback && (
                    <div className="feedback-text">{step.submission.curatorFeedback}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {(!hasSubmission || isReturned) && (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (step.formSchema && step.formSchema.fields && step.formSchema.fields.length > 0
                  ? step.formSchema.fields
                      .filter((f) => f.required)
                      .some((f) => !formAnswers[f.id]?.trim())
                  : !answer.trim())
              }
            >
              {submitting ? 'Отправка...' : 'Отправить на проверку'}
            </button>
          )}
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          ← Назад
        </button>
      )}
    </div>
  );
}

