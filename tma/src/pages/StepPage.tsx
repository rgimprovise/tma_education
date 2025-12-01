import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
    enrollment?: {
      id: string;
      status: 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';
    };
  };
  submission?: {
    id: string;
    status: string;
    answerText?: string;
    aiScore?: number;
    aiFeedback?: string;
    curatorScore?: number;
    curatorFeedback?: string;
    resubmissionRequested: boolean;
    resubmissionRequestedAt?: string;
  };
}

export function StepPage() {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step | null>(null);
  const [answer, setAnswer] = useState('');
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingResubmission, setRequestingResubmission] = useState(false);
  const [startingAudioSubmission, setStartingAudioSubmission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLearner = user?.role === 'LEARNER';

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

  const handleRequestResubmission = async () => {
    if (!step || !step.submission) return;

    try {
      setRequestingResubmission(true);
      setError(null);

      await api.post(`/submissions/${step.submission.id}/request-resubmission`);

      // Обновляем step локально (перезагружаем данные)
      const response = await api.get(`/course/steps/${stepId}`);
      setStep(response.data);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Запрос на повторную отправку отправлен куратору. Дождитесь его решения.');
      }
    } catch (err: any) {
      console.error('Request resubmission error:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при запросе повторной отправки';
      setError(errorMessage);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      }
    } finally {
      setRequestingResubmission(false);
    }
  };

  const handleSubmit = async () => {
    if (!step) return;

    // 1. Проверяем статус модуля перед отправкой
    if (!step.module.enrollment || step.module.enrollment.status !== 'IN_PROGRESS') {
      const message = 'Модуль ещё не открыт куратором. Дождитесь открытия модуля для прохождения.';
      setError(message);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`⚠️ ${message}`);
      }
      return;
    }

    // 2. Проверяем, не отправлен ли уже ответ
    // Разрешаем отправку, если:
    // - submission отсутствует (null) - можно отправлять
    // - submission есть, но статус CURATOR_RETURNED - можно переотправить
    // Блокируем, если submission есть и статус не CURATOR_RETURNED
    if (step.submission && step.submission.status !== 'CURATOR_RETURNED') {
      const message = 'Вы уже отправили ответ на это задание. Дождитесь проверки куратора.';
      setError(message);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`ℹ️ ${message}`);
      }
      return;
    }

    // 3. Проверяем, есть ли динамическая форма
    const hasFormSchema = step.formSchema && step.formSchema.fields && step.formSchema.fields.length > 0;

    if (hasFormSchema) {
      // Валидация обязательных полей
      const requiredFields = step.formSchema!.fields.filter((f) => f.required);
      const missingFields = requiredFields.filter((f) => !formAnswers[f.id]?.trim());
      
      if (missingFields.length > 0) {
        const message = `Заполните обязательные поля: ${missingFields.map((f) => f.label).join(', ')}`;
        setError(message);
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

      console.log('Отправка submission:', {
        stepId: step.id,
        moduleId: step.module.id,
        answerType: step.expectedAnswer,
        hasText: !!answerText,
      });

      await api.post('/submissions', {
        stepId: step.id,
        moduleId: step.module.id,
        answerText,
        answerType: step.expectedAnswer || 'TEXT',
      });

      // Перезагружаем данные шага, чтобы обновить submission
      const response = await api.get(`/course/steps/${stepId}`);
      setStep(response.data);
      
      // Очищаем поля ответа
      setAnswer('');
      setFormAnswers({});

      // Показываем уведомление об успехе
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Ответ отправлен на проверку!', () => {
          navigate(-1);
        });
      } else {
        alert('✅ Ответ отправлен на проверку!');
        navigate(-1);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Неизвестная ошибка';
      
      if (err.response) {
        if (err.response.data?.message) {
          errorMessage = Array.isArray(err.response.data.message)
            ? err.response.data.message.join('; ')
            : err.response.data.message;
        } else if (err.response.status === 400) {
          errorMessage = 'Некорректные данные. Проверьте заполнение полей.';
        } else if (err.response.status === 401) {
          errorMessage = 'Ошибка авторизации. Перезайдите в приложение.';
        } else if (err.response.status === 403) {
          errorMessage = 'Модуль ещё не открыт куратором. Дождитесь открытия модуля.';
        } else if (err.response.status === 404) {
          errorMessage = 'Шаг или модуль не найден.';
        } else if (err.response.status >= 500) {
          errorMessage = 'Ошибка сервера. Попробуйте позже.';
        }
      } else if (err.request) {
        errorMessage = 'Нет связи с сервером. Проверьте интернет-соединение.';
      }
      
      setError(errorMessage);
      
      // Показываем ошибку только через Telegram WebApp alert (не через setError)
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ Не удалось отправить ответ:\n\n${errorMessage}`);
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
  const isReturned = step.submission?.status === 'CURATOR_RETURNED';

  const handleBackToModule = () => {
    navigate(`/modules/${step.module.id}`);
  };

  const handleStartAudioSubmission = async () => {
    if (!step) return;

    try {
      setStartingAudioSubmission(true);
      setError(null);

      await api.post('/audio-submissions/start', {
        stepId: step.id,
        moduleId: step.module.id,
      });

      // Показываем успешное сообщение с инструкцией
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          '✅ Инструкция отправлена в чат с ботом!\n\n' +
          'Вернитесь в диалог с ботом и отправьте голосовое сообщение ' +
          'ОТВЕТОМ (реплаем) на инструкцию.\n\n' +
          '⚠️ Важно: обязательно отправьте аудио ответом на сообщение бота, ' +
          'иначе он не сможет связать его с заданием.',
          () => {
            // После закрытия alert - закрываем Mini App, чтобы пользователь вернулся в чат
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.close();
            }
          }
        );
      } else {
        alert(
          'Инструкция отправлена в диалог с ботом. ' +
          'Перейдите туда и отправьте голосовое сообщение ответом на инструкцию.'
        );
      }

      // Обновляем данные о шаге, чтобы отобразить submission
      const response = await api.get(`/course/steps/${step.id}`);
      setStep(response.data);
    } catch (err: any) {
      console.error('Audio submission start error:', err);
      
      let errorMessage = 'Неизвестная ошибка';
      
      if (err.response?.data?.message) {
        errorMessage = Array.isArray(err.response.data.message)
          ? err.response.data.message.join('; ')
          : err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = 'Модуль ещё не открыт куратором.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.message || 'Некорректный запрос.';
      }
      
      setError(errorMessage);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ Ошибка:\n\n${errorMessage}`);
      }
    } finally {
      setStartingAudioSubmission(false);
    }
  };

  return (
    <div className="container">
      <button className="btn-back" onClick={handleBackToModule}>
        ← Назад к заданиям модуля
      </button>

      <div className="page-header">
        <h1 className="page-title">{step.title}</h1>
      </div>

      <div className="step-content">
        <div className="content-text">{step.content}</div>
      </div>

      {step.type === 'TASK' || step.type === 'QUIZ' || step.type === 'EXAM' ? (
        <div className="step-form">
          {/* Специальный UX для AUDIO/VIDEO заданий */}
          {(step.expectedAnswer === 'AUDIO' || step.expectedAnswer === 'VIDEO') ? (
            <>
              {/* Инструкция для аудио-сдачи */}
              {(!hasSubmission || isReturned) && (
                <div className="audio-submission-info">
                  <div className="info-card">
                    <h3>🎤 Аудио-задание</h3>
                    <p>Это задание нужно сдать голосовым сообщением в Telegram.</p>
                    <ol className="instruction-list">
                      <li>Нажмите кнопку «Сдать голосовым сообщением» ниже.</li>
                      <li>В чат с ботом придёт сообщение с инструкцией.</li>
                      <li>Запишите голосовое сообщение и отправьте его <strong>ответом (реплаем)</strong> на инструкцию бота.</li>
                      <li>Бот автоматически обработает ваш ответ и отправит куратору на проверку.</li>
                    </ol>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Обычная форма для TEXT/FILE заданий
            <>
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
            </>
          )}

          {error && <div className="error">{error}</div>}

          {hasSubmission && step.submission && (
            <div className="submission-info">
              {/* Статус для всех */}
              <div className="submission-status">
                {step.submission.status === 'SENT' && '📤 Ответ отправлен, ожидает проверки'}
                {step.submission.status === 'AI_REVIEWED' && '🤖 Предварительно проверено ИИ, ожидает куратора'}
                {step.submission.status === 'CURATOR_APPROVED' && '✅ Одобрено куратором'}
                {step.submission.status === 'CURATOR_RETURNED' && '🔄 Возвращено на доработку'}
              </div>

              {/* Показываем транскрипт для аудио-сдач */}
              {(step.expectedAnswer === 'AUDIO' || step.expectedAnswer === 'VIDEO') && 
               step.submission.answerText && (
                <div className="transcript-block">
                  <div className="feedback-title">
                    {step.expectedAnswer === 'AUDIO' ? '🎤 Транскрипт голосового сообщения:' : '📹 Транскрипт видео:'}
                  </div>
                  <div className="transcript-text">{step.submission.answerText}</div>
                </div>
              )}

              {/* Блок ИИ - ТОЛЬКО для кураторов/админов */}
              {!isLearner && step.submission.aiScore !== null && step.submission.aiScore !== undefined && (
                <div className="feedback-block ai-feedback">
                  <div className="feedback-title">🤖 Оценка ИИ: {step.submission.aiScore}/10</div>
                  {step.submission.aiFeedback && (
                    <div className="feedback-text">{step.submission.aiFeedback}</div>
                  )}
                </div>
              )}

              {/* Блок куратора - для всех */}
              {step.submission.curatorScore !== null && step.submission.curatorScore !== undefined && (
                <div className="feedback-block curator-feedback">
                  <div className="feedback-title">
                    ✅ Оценка куратора: {step.submission.curatorScore}/10
                  </div>
                  {step.submission.curatorFeedback && (
                    <div className="feedback-text">{step.submission.curatorFeedback}</div>
                  )}
                </div>
              )}

              {/* Для LEARNER: подсказка если ещё нет оценки куратора */}
              {isLearner && 
               step.submission.status !== 'CURATOR_APPROVED' && 
               step.submission.status !== 'CURATOR_RETURNED' && (
                <div className="info-hint">
                  ℹ️ Ваш ответ проверяется куратором. Результат появится здесь после проверки.
                </div>
              )}

              {/* Для LEARNER: кнопка запроса повторной отправки */}
              {/* Показываем только если submission существует, не одобрена, и запрос еще не отправлен */}
              {isLearner && 
               step.submission &&
               step.submission.status !== 'CURATOR_APPROVED' && 
               !step.submission.resubmissionRequested && (
                <button
                  className="btn btn-secondary"
                  onClick={handleRequestResubmission}
                  disabled={requestingResubmission}
                  style={{ marginTop: '12px' }}
                >
                  {requestingResubmission ? 'Отправка запроса...' : '🔄 Запросить повторную отправку'}
                </button>
              )}

              {/* Для LEARNER: бейдж если запрос уже отправлен */}
              {isLearner && step.submission.resubmissionRequested && (
                <div className="resubmission-badge">
                  🔄 Запрос на повторную отправку отправлен куратору. Ожидайте решения.
                </div>
              )}
            </div>
          )}

          {(!hasSubmission || isReturned) && (
            <>
              {/* Для AUDIO/VIDEO - только кнопка аудио-сдачи */}
              {(step.expectedAnswer === 'AUDIO' || step.expectedAnswer === 'VIDEO') ? (
                <button
                  className="btn btn-primary"
                  onClick={handleStartAudioSubmission}
                  disabled={startingAudioSubmission}
                >
                  {startingAudioSubmission 
                    ? '⏳ Отправка инструкции...' 
                    : step.expectedAnswer === 'AUDIO' 
                      ? '🎤 Сдать голосовым сообщением' 
                      : '📹 Сдать видео-сообщением'}
                </button>
              ) : (
                // Для TEXT/FILE - обычная кнопка отправки
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
            </>
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

