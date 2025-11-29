import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CourseBuilderModulesPage.css';

interface Course {
  id: string;
  title: string;
  description?: string;
}

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

export function CourseBuilderModulesPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      
      // Загружаем информацию о курсе
      const courseResponse = await api.get(`/admin/courses/${courseId}`);
      const courseData = courseResponse.data;
      
      setCourse({
        id: courseData.id,
        title: courseData.title,
        description: courseData.description,
      });

      // Загружаем модули курса
      const modulesResponse = await api.get('/admin/course/modules');
      // Фильтруем модули по courseId
      const courseModules = modulesResponse.data.filter(
        (m: CourseModule & { courseId?: string }) => m.courseId === courseId
      );
      setModules(courseModules);
    } catch (err: any) {
      console.error('Failed to load course data:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки данных курса');
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
      await loadCourseData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Ошибка при удалении модуля');
    }
  };

  const handleAddModule = () => {
    // Переход на страницу создания модуля с courseId
    navigate(`/curator/course/modules/new?courseId=${courseId}`);
  };

  const handleModuleClick = (moduleId: string) => {
    // Переход на редактор модуля
    navigate(`/curator/course/modules/${moduleId}`);
  };

  const handleBackToCourses = () => {
    navigate('/curator/course-builder');
  };

  if (loading) {
    return (
      <div className="course-builder-modules">
        <div className="loading">Загрузка модулей курса...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-builder-modules">
        <button className="btn-back" onClick={handleBackToCourses}>
          ← Назад к списку курсов
        </button>
        <div className="error">{error || 'Курс не найден'}</div>
      </div>
    );
  }

  return (
    <div className="course-builder-modules">
      <button className="btn-back" onClick={handleBackToCourses}>
        ← Назад к списку курсов
      </button>

      <div className="page-header">
        <div className="header-main">
          <h1 className="page-title">
            🔧 {course.title}
          </h1>
          <span className="builder-mode-badge">Конструктор</span>
        </div>
        {course.description && (
          <p className="page-description">{course.description}</p>
        )}
      </div>

      <div className="actions-bar">
        <button className="btn btn-primary" onClick={handleAddModule}>
          ➕ Добавить модуль
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <h2 className="empty-state-title">Нет модулей</h2>
          <p className="empty-state-description">
            Создайте первый модуль для этого курса
          </p>
        </div>
      ) : (
        <div className="modules-list">
          {modules.map((module) => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => handleModuleClick(module.id)}
            >
              <div className="module-header">
                <div className="module-title-wrapper">
                  <span className="module-index">Модуль {module.index}</span>
                  <h3 className="module-title">{module.title}</h3>
                  {module.isExam && <span className="exam-badge">🎓 Экзамен</span>}
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
                <p className="module-description">{module.description}</p>
              )}

              <div className="module-meta">
                <span className="meta-item">
                  📝 Шагов: {module._count?.steps || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

