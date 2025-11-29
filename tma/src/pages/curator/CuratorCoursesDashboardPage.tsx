import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CuratorCoursesDashboardPage.css';

interface CourseModule {
  id: string;
  index: number;
  title: string;
  description?: string;
  isExam: boolean;
  stepsCount?: number;
  enrollmentsCount?: number;
}

export function CuratorCoursesDashboardPage() {
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
      setError(err.response?.data?.message || 'Ошибка загрузки курсов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = () => {
    // Переход на страницу создания нового курса
    navigate('/curator/course/modules/new');
  };

  const handleCourseClick = (moduleId: string) => {
    // Переход на детальную страницу курса
    navigate(`/curator/courses/${moduleId}`);
  };

  if (loading) {
    return (
      <div className="curator-courses-dashboard">
        <div className="loading">Загрузка курсов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="curator-courses-dashboard">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="curator-courses-dashboard">
      <div className="page-header">
        <h1 className="page-title">Управление курсами</h1>
        <button className="btn btn-primary" onClick={handleCreateCourse}>
          ➕ Создать курс
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h2 className="empty-state-title">Нет курсов</h2>
          <p className="empty-state-description">
            Создайте первый курс, нажав кнопку «Создать курс» выше
          </p>
        </div>
      ) : (
        <div className="courses-grid">
          {modules.map((module) => (
            <div
              key={module.id}
              className="course-card"
              onClick={() => handleCourseClick(module.id)}
            >
              <div className="course-card-header">
                <h3 className="course-card-title">
                  {module.isExam ? '🎓' : '📖'} {module.title}
                </h3>
                <span className="course-card-index">Модуль {module.index}</span>
              </div>
              
              {module.description && (
                <p className="course-card-description">{module.description}</p>
              )}
              
              <div className="course-card-stats">
                <div className="stat-item">
                  <span className="stat-icon">📝</span>
                  <span className="stat-text">
                    {module.stepsCount !== undefined ? `${module.stepsCount} шагов` : 'Загрузка...'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">👥</span>
                  <span className="stat-text">
                    {module.enrollmentsCount !== undefined ? `${module.enrollmentsCount} участников` : '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

