import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import './CourseModuleEditorPage.css';

interface ModuleData {
  courseId?: string;
  title: string;
  description: string;
  index: number;
  isExam: boolean;
}

export function CourseModuleEditorPage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId') || undefined;
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ModuleData>({
    courseId,
    title: '',
    description: '',
    index: 1,
    isExam: false,
  });

  // В роуте создания модуля (`/curator/course/modules/new`) параметр moduleId отсутствует,
  // поэтому считаем создание и при moduleId === undefined.
  const isNew = !moduleId || moduleId === 'new';

  useEffect(() => {
    if (!isNew && moduleId) {
      loadModule();
    }
  }, [moduleId, isNew]);

  const loadModule = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/course/modules/${moduleId}`);
      setFormData({
        title: response.data.title || '',
        description: response.data.description || '',
        index: response.data.index || 1,
        isExam: response.data.isExam || false,
      });
    } catch (err: any) {
      console.error('Failed to load module:', err);
      alert(err.response?.data?.message || 'Ошибка загрузки модуля');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (isNew) {
        await api.post('/admin/course/modules', formData);
      } else {
        await api.patch(`/admin/course/modules/${moduleId}`, formData);
      }
      
      // Возвращаемся на правильную страницу
      if (courseId) {
        // Если был courseId, возвращаемся на страницу модулей этого курса
        navigate(`/curator/course-builder/${courseId}`);
      } else {
        // Иначе возвращаемся на общую страницу конструктора
        navigate('/curator/course-builder');
      }
    } catch (err: any) {
      console.error('Failed to save module:', err);
      alert(err.response?.data?.message || 'Ошибка сохранения модуля');
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
            {isNew ? 'Создать модуль' : 'Редактировать модуль'}
          </h1>
        </div>

        <div className="form">
          <div className="form-group">
            <label className="form-label">Название модуля *</label>
            <input
              className="form-input"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Например: Основы пирамиды Минто"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Краткое описание модуля"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Порядковый номер *</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="10"
              value={formData.index}
              onChange={(e) => setFormData({ ...formData, index: parseInt(e.target.value) || 1 })}
            />
          </div>

          <div className="form-group">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={formData.isExam}
                onChange={(e) => setFormData({ ...formData, isExam: e.target.checked })}
              />
              <span>Это экзамен</span>
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/curator/course')}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formData.title}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          {!isNew && (
            <button
              className="btn btn-secondary mt-16"
              onClick={() => navigate(`/curator/course/modules/${moduleId}/steps`)}
            >
              Перейти к шагам →
            </button>
          )}
        </div>
    </div>
  );
}

