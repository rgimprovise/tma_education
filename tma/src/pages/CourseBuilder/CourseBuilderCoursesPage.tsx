import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CourseBuilderCoursesPage.css';

interface Course {
  id: string;
  title: string;
  description?: string;
  modulesCount: number;
  learnersCount: number;
  createdAt: string;
  updatedAt: string;
}

export function CourseBuilderCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/courses');
      setCourses(response.data);
    } catch (err: any) {
      console.error('Failed to load courses:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки курсов');
    } finally {
      setLoading(false);
    }
  };

  const handleCourseClick = (courseId: string) => {
    navigate(`/curator/course-builder/${courseId}`);
  };

  if (loading) {
    return (
      <div className="course-builder-courses">
        <div className="loading">Загрузка курсов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-builder-courses">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="course-builder-courses">
      <div className="page-header">
        <h1 className="page-title">🔧 Конструктор курса</h1>
        <p className="page-subtitle">Выберите курс, чтобы управлять модулями и заданиями</p>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h2 className="empty-state-title">Нет курсов</h2>
          <p className="empty-state-description">
            Создайте первый курс на вкладке «Курсы»
          </p>
        </div>
      ) : (
        <div className="courses-grid">
          {courses.map((course) => (
            <div
              key={course.id}
              className="course-card"
              onClick={() => handleCourseClick(course.id)}
            >
              <div className="course-card-header">
                <h3 className="course-card-title">
                  🔧 {course.title}
                </h3>
              </div>
              
              {course.description && (
                <p className="course-card-description">{course.description}</p>
              )}
              
              <div className="course-card-stats">
                <div className="stat-item">
                  <span className="stat-icon">📖</span>
                  <span className="stat-text">
                    {course.modulesCount} {course.modulesCount === 1 ? 'модуль' : course.modulesCount < 5 ? 'модуля' : 'модулей'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">👥</span>
                  <span className="stat-text">
                    {course.learnersCount} {course.learnersCount === 1 ? 'участник' : course.learnersCount < 5 ? 'участника' : 'участников'}
                  </span>
                </div>
              </div>

              <div className="builder-badge">
                <span className="builder-badge-icon">🔧</span>
                <span className="builder-badge-text">Режим редактирования</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

