import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { FormSchemaBuilder } from '../components/FormSchemaBuilder';
import './CourseStepEditorPage.css';

interface StepData {
  moduleId: string;
  title: string;
  type: 'INFO' | 'TASK' | 'QUIZ' | 'EXAM';
  index: number;
  content: string;
  expectedAnswer: 'TEXT' | 'AUDIO' | 'VIDEO' | 'FILE';
  requiresAiReview: boolean;
  maxScore: number;
  isRequired: boolean;
  formSchema?: any;
  aiRubric?: string;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'file';
  required: boolean;
}

export function CourseStepEditorPage() {
  const { moduleId, stepId } = useParams<{ moduleId: string; stepId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<StepData>({
    moduleId: moduleId || '',
    title: '',
    type: 'TASK',
    index: 0,
    content: '',
    expectedAnswer: 'TEXT',
    requiresAiReview: false,
    maxScore: 10,
    isRequired: true,
    formSchema: null,
    aiRubric: '',
  });
  const [formFields, setFormFields] = useState<FormField[]>([]);

  // В роуте создания шага (`/curator/course/modules/:moduleId/steps/new`) параметр stepId отсутствует,
  // поэтому считаем создание и при stepId === undefined.
  const isNew = !stepId || stepId === 'new';

  useEffect(() => {
    if (!isNew && stepId) {
      loadStep();
    } else if (moduleId) {
      // Для нового шага определяем следующий индекс
      loadNextIndex();
    }
  }, [stepId, moduleId, isNew]);

  const loadNextIndex = async () => {
    try {
      const response = await api.get(`/admin/course/modules/${moduleId}/steps`);
      const maxIndex = response.data.length > 0
        ? Math.max(...response.data.map((s: any) => s.index))
        : -1;
      setFormData((prev) => ({ ...prev, index: maxIndex + 1 }));
    } catch (err) {
      console.error('Failed to load steps:', err);
    }
  };

  const loadStep = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/course/steps/${stepId}`);
      const step = response.data;
      setFormData({
        moduleId: step.moduleId,
        title: step.title || '',
        type: step.type || 'TASK',
        index: step.index || 0,
        content: step.content || '',
        expectedAnswer: step.expectedAnswer || 'TEXT',
        requiresAiReview: step.requiresAiReview || false,
        maxScore: step.maxScore || 10,
        isRequired: step.isRequired !== undefined ? step.isRequired : true,
        formSchema: step.formSchema || null,
        aiRubric: step.aiRubric || '',
      });

      // Парсим formSchema в массив полей
      if (step.formSchema && Array.isArray(step.formSchema.fields)) {
        setFormFields(step.formSchema.fields);
      } else {
        setFormFields([]);
      }
    } catch (err: any) {
      console.error('Failed to load step:', err);
      alert(err.response?.data?.message || 'Ошибка загрузки шага');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Валидация перед отправкой
    if (!formData.title.trim()) {
      alert('❌ Пожалуйста, укажите название шага');
      return;
    }

    if (!formData.content.trim()) {
      alert('❌ Пожалуйста, укажите содержание шага');
      return;
    }

    try {
      setSaving(true);

      // Формируем formSchema из полей
      const formSchema = formFields.length > 0
        ? { fields: formFields }
        : null;

      // Подготовка данных для отправки
      const dataToSave = {
        ...formData,
        formSchema,
        // Если aiRubric пустая строка, отправляем undefined
        aiRubric: formData.aiRubric?.trim() || undefined,
      };

      if (isNew) {
        // При создании отправляем всё, включая moduleId
        await api.post('/admin/course/steps', dataToSave);
      } else {
        // При обновлении НЕ отправляем moduleId (он не должен меняться)
        const { moduleId: _, ...updateData } = dataToSave;
        await api.patch(`/admin/course/steps/${stepId}`, updateData);
      }

      // Показываем уведомление об успехе
      alert('✅ Шаг успешно сохранён!');
      
      // Возвращаемся к списку шагов
      navigate(`/curator/course/modules/${moduleId}/steps`);
    } catch (err: any) {
      console.error('Failed to save step:', err);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Неизвестная ошибка';
      
      if (err.response) {
        // Ошибка от сервера
        if (err.response.data?.message) {
          errorMessage = Array.isArray(err.response.data.message)
            ? err.response.data.message.join('\n')
            : err.response.data.message;
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.status === 400) {
          errorMessage = 'Некорректные данные. Проверьте все поля.';
        } else if (err.response.status === 401) {
          errorMessage = 'Ошибка авторизации. Перезайдите в приложение.';
        } else if (err.response.status === 403) {
          errorMessage = 'Недостаточно прав для этого действия.';
        } else if (err.response.status === 404) {
          errorMessage = 'Шаг не найден.';
        } else if (err.response.status === 409) {
          errorMessage = 'Конфликт данных. Возможно, шаг с таким индексом уже существует.';
        } else if (err.response.status >= 500) {
          errorMessage = 'Ошибка сервера. Попробуйте позже.';
        }
      } else if (err.request) {
        // Запрос был отправлен, но ответа не получено
        errorMessage = 'Нет связи с сервером. Проверьте интернет-соединение.';
      }
      
      // Показываем ошибку пользователю
      alert(`❌ Не удалось сохранить шаг:\n\n${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="container">
        <div className="page-header">
          <h1 className="page-title">
            {isNew ? 'Создать шаг' : 'Редактировать шаг'}
          </h1>
        </div>

        <div className="form">
          <div className="form-group">
            <label className="form-label">Название шага *</label>
            <input
              className="form-input"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например: Задание 1.1"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Тип шага *</label>
              <select
                className="form-input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="INFO">📖 Информация</option>
                <option value="TASK">✍️ Задание</option>
                <option value="QUIZ">❓ Квиз</option>
                <option value="EXAM">📝 Экзамен</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Порядковый номер *</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={formData.index}
                onChange={(e) => setFormData({ ...formData, index: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Содержание *</label>
            <textarea
              className="form-textarea"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Текст задания или теории..."
              rows={8}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Тип ответа</label>
              <select
                className="form-input"
                value={formData.expectedAnswer}
                onChange={(e) => setFormData({ ...formData, expectedAnswer: e.target.value as any })}
              >
                <option value="TEXT">Текст</option>
                <option value="AUDIO">Аудио</option>
                <option value="VIDEO">Видео</option>
                <option value="FILE">Файл</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Максимальный балл</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={formData.maxScore}
                onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) || 10 })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={formData.requiresAiReview}
                onChange={(e) => setFormData({ ...formData, requiresAiReview: e.target.checked })}
              />
              <span>Требуется проверка ИИ</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              />
              <span>Обязательный шаг для завершения модуля</span>
            </label>
          </div>

          {/* Конструктор формы */}
          <div className="form-section">
            <h3 className="section-title">Форма ответа</h3>
            <p className="section-hint">
              Создайте динамическую форму для ответа. Если форма не задана, будет использовано простое текстовое поле.
            </p>
            <FormSchemaBuilder fields={formFields} onChange={setFormFields} />
          </div>

          {/* Критерии ИИ */}
          <div className="form-section">
            <h3 className="section-title">Критерии для ИИ-проверки</h3>
            <p className="section-hint">
              Опишите критерии оценки для этого задания. Если не указано, будут использованы общие критерии по принципу Минто.
            </p>
            <textarea
              className="form-textarea"
              value={formData.aiRubric || ''}
              onChange={(e) => setFormData({ ...formData, aiRubric: e.target.value })}
              placeholder="Например:&#10;1. Главная мысль в начале (0-3 балла)&#10;2. Структурированные опоры (0-3 балла)&#10;3. Детали и факты (0-2 балла)"
              rows={6}
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => navigate(`/curator/course/modules/${moduleId}/steps`)}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formData.title || !formData.content}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
    </div>
  );
}

