import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CourseDashboardPage.css';

interface Course {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  modules: CourseModule[];
}

interface CourseModule {
  id: string;
  index: number;
  title: string;
  description?: string;
  isExam: boolean;
  stepsCount: number;
  enrollmentsCount: number;
}

export function CourseDashboardPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
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
      
      // Загружаем информацию о курсе с модулями
      const courseResponse = await api.get(`/admin/courses/${courseId}`);
      setCourse(courseResponse.data);
    } catch (err: any) {
      console.error('Failed to load course data:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки данных курса');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (moduleId: string) => {
    // В будущем: переход на дашборд модуля
    // Пока: переход в редактор модуля
    navigate(`/curator/course/modules/${moduleId}`);
  };

  const handleCreateModule = () => {
    // Переход на создание нового модуля для этого курса
    navigate(`/curator/course/modules/new?courseId=${courseId}`);
  };

  const handleBackToCourses = () => {
    navigate('/curator/courses');
  };

  if (loading) {
    return (
      <div className="course-dashboard">
        <div className="loading">Загрузка данных курса...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-dashboard">
        <button className="btn-back" onClick={handleBackToCourses}>
          ← Назад к списку курсов
        </button>
        <div className="error">{error || 'Курс не найден'}</div>
      </div>
    );
  }

  // Подсчёт общей статистики по курсу
  const totalModules = course.modules.length;
  const totalSteps = course.modules.reduce((sum, m) => sum + m.stepsCount, 0);
  const totalLearners = course.modules.reduce((sum, m) => sum + m.enrollmentsCount, 0);
  // Уникальные участники (в будущем можно сделать точнее)
  const uniqueLearners = Math.max(...course.modules.map(m => m.enrollmentsCount), 0);

  return (
    <div className="course-dashboard">
      <button className="btn-back" onClick={handleBackToCourses}>
        ← Назад к списку курсов
      </button>

      <div className="course-header">
        <div className="course-header-main">
          <h1 className="course-title">
            📚 {course.title}
          </h1>
        </div>
        {course.description && (
          <p className="course-description">{course.description}</p>
        )}
        <div className="course-header-info">
          <span className="header-info-item">
            📖 {totalModules} {totalModules === 1 ? 'модуль' : totalModules < 5 ? 'модуля' : 'модулей'}
          </span>
          <span className="header-info-item">
            📝 {totalSteps} {totalSteps === 1 ? 'шаг' : totalSteps < 5 ? 'шага' : 'шагов'}
          </span>
          <span className="header-info-item">
            👥 {uniqueLearners} {uniqueLearners === 1 ? 'участник' : uniqueLearners < 5 ? 'участника' : 'участников'}
          </span>
        </div>
      </div>

      <div className="modules-section">
        <div className="section-header">
          <h2 className="section-title">Модули курса</h2>
          <button className="btn btn-secondary" onClick={handleCreateModule}>
            ➕ Добавить модуль
          </button>
        </div>

        {course.modules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📖</div>
            <h3 className="empty-state-title">Нет модулей</h3>
            <p className="empty-state-description">
              Добавьте первый модуль в этот курс
            </p>
          </div>
        ) : (
          <div className="modules-grid">
            {course.modules.map((module) => (
              <div
                key={module.id}
                className="module-card"
                onClick={() => handleModuleClick(module.id)}
              >
                <div className="module-card-header">
                  <h3 className="module-card-title">
                    {module.isExam ? '🎓' : '📖'} {module.title}
                  </h3>
                  <span className="module-card-index">Модуль {module.index}</span>
                </div>

                {module.description && (
                  <p className="module-card-description">{module.description}</p>
                )}

                <div className="module-card-stats">
                  <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <span className="stat-text">
                      {module.stepsCount} {module.stepsCount === 1 ? 'шаг' : module.stepsCount < 5 ? 'шага' : 'шагов'}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">👥</span>
                    <span className="stat-text">
                      {module.enrollmentsCount} {module.enrollmentsCount === 1 ? 'участник' : module.enrollmentsCount < 5 ? 'участника' : 'участников'}
                    </span>
                  </div>
                </div>

                {module.isExam && (
                  <div className="module-badge exam-badge">Экзамен</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="course-info-section">
        <h2 className="section-title">Информация о курсе</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Создан:</span>
            <span className="info-value">
              {new Date(course.createdAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Обновлён:</span>
            <span className="info-value">
              {new Date(course.updatedAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

