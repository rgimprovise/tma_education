import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './CuratorCoursesDashboardPage.css';

interface Course {
  id: string;
  title: string;
  description?: string;
  modulesCount: number;
  learnersCount: number;
  createdAt: string;
  updatedAt: string;
}

export function CuratorCoursesDashboardPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [creating, setCreating] = useState(false);

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

  const handleCreateCourse = () => {
    setShowCreateForm(true);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewCourseTitle('');
    setNewCourseDescription('');
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;

    try {
      setCreating(true);
      const response = await api.post('/admin/courses', {
        title: newCourseTitle,
        description: newCourseDescription,
      });
      
      // Переход на дашборд созданного курса
      navigate(`/curator/courses/${response.data.id}`);
    } catch (err: any) {
      console.error('Failed to create course:', err);
      alert(err.response?.data?.message || 'Ошибка создания курса');
    } finally {
      setCreating(false);
    }
  };

  const handleCourseClick = (courseId: string) => {
    // Переход на детальную страницу курса
    navigate(`/curator/courses/${courseId}`);
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
        <h1 className="page-title">Курсы</h1>
        <button className="btn btn-primary" onClick={handleCreateCourse}>
          ➕ Создать курс
        </button>
      </div>

      {/* Форма создания курса */}
      {showCreateForm && (
        <div className="create-course-modal">
          <div className="modal-content">
            <h2 className="modal-title">Создание нового курса</h2>
            <form onSubmit={handleSubmitCreate}>
              <div className="form-group">
                <label htmlFor="courseTitle">Название курса *</label>
                <input
                  id="courseTitle"
                  type="text"
                  className="form-input"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="Например: Пирамида Минто"
                  required
                  disabled={creating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="courseDescription">Описание курса</label>
                <textarea
                  id="courseDescription"
                  className="form-textarea"
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Краткое описание курса..."
                  rows={3}
                  disabled={creating}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelCreate}
                  disabled={creating}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !newCourseTitle.trim()}
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📚</div>
          <h2 className="empty-state-title">Нет курсов</h2>
          <p className="empty-state-description">
            Создайте первый курс, нажав кнопку «Создать курс» выше
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
                  📚 {course.title}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

