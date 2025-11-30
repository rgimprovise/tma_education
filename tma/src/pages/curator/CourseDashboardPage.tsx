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
  autoUnlockForNewLearners?: boolean;
}

export function CourseDashboardPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockingModuleId, setUnlockingModuleId] = useState<string | null>(null);
  const [lockingModuleId, setLockingModuleId] = useState<string | null>(null);
  const [settingAutoUnlock, setSettingAutoUnlock] = useState<string | null>(null);

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

  const handleEditModule = (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Переход в редактор модуля
    navigate(`/curator/course/modules/${moduleId}`);
  };

  const handleCreateModule = () => {
    // Переход на создание нового модуля для этого курса
    navigate(`/curator/course/modules/new?courseId=${courseId}`);
  };

  const handleUnlockModule = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Не открывать карточку модуля

    if (!confirm('Открыть этот модуль для всех зарегистрированных учеников?')) {
      return;
    }

    try {
      setUnlockingModuleId(moduleId);
      const response = await api.post(`/admin/modules/${moduleId}/unlock`, {
        forAll: true,
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          response.data.message || `Модуль открыт для ${response.data.unlocked} учеников`
        );
      } else {
        alert(response.data.message || `Модуль открыт для ${response.data.unlocked} учеников`);
      }
      
      // Обновляем данные курса чтобы увидеть новое количество enrollments
      await loadCourseData();
    } catch (err: any) {
      console.error('Failed to unlock module:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при открытии модуля';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setUnlockingModuleId(null);
    }
  };

  const handleLockModule = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Не открывать карточку модуля

    if (!confirm('Заблокировать этот модуль для всех учеников? Все enrollments будут удалены.')) {
      return;
    }

    try {
      setLockingModuleId(moduleId);
      const response = await api.post(`/admin/modules/${moduleId}/lock`, {
        forAll: true,
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          response.data.message || `Модуль заблокирован для ${response.data.locked} учеников`
        );
      } else {
        alert(response.data.message || `Модуль заблокирован для ${response.data.locked} учеников`);
      }
      
      // Обновляем данные курса
      await loadCourseData();
    } catch (err: any) {
      console.error('Failed to lock module:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при блокировке модуля';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setLockingModuleId(null);
    }
  };

  const handleToggleAutoUnlock = async (moduleId: string, currentValue: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    const newValue = !currentValue;
    const confirmMessage = newValue
      ? 'Включить автоматическое открытие этого модуля для новых учеников?\n\nНовые ученики будут автоматически получать доступ к этому модулю при регистрации.'
      : 'Отключить автоматическое открытие этого модуля для новых учеников?\n\nНовые ученики больше не будут автоматически получать доступ к этому модулю.';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setSettingAutoUnlock(moduleId);
      const response = await api.patch(`/admin/modules/${moduleId}/auto-unlock`, {
        autoUnlock: newValue,
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(response.data.message || 'Настройка сохранена');
      } else {
        alert(response.data.message || 'Настройка сохранена');
      }

      // Обновляем данные курса
      await loadCourseData();
    } catch (err: any) {
      console.error('Failed to set auto-unlock:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при сохранении настройки';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setSettingAutoUnlock(null);
    }
  };

  const handleBackToCourses = () => {
    navigate('/curator/courses');
  };

  const handleOpenReport = async () => {
    if (!courseId) return;

    try {
      // Получаем токен для авторизации
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Необходима авторизация');
        return;
      }

      // Формируем URL для отчёта
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const reportUrl = `${apiUrl}/admin/courses/${courseId}/report/html`;
      
      // Используем fetch для получения HTML с авторизацией
      const response = await fetch(reportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки отчёта');
      }

      const html = await response.text();
      
      // Создаём новое окно и вставляем HTML
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      } else {
        alert('Не удалось открыть отчёт. Разрешите всплывающие окна в настройках браузера.');
      }
    } catch (err: any) {
      console.error('Failed to load report:', err);
      const errorMessage = err.message || 'Неизвестная ошибка';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ Ошибка загрузки отчёта: ${errorMessage}`);
      } else {
        alert(`❌ Ошибка загрузки отчёта: ${errorMessage}`);
      }
    }
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
  
  // Уникальные участники по курсу (грубая оценка - максимум enrollments по модулям)
  const uniqueLearners = Math.max(...course.modules.map(m => m.enrollmentsCount), 0);
  
  // Количество модулей с хотя бы одним enrollment (открытые модули)
  const modulesWithEnrollments = course.modules.filter(m => m.enrollmentsCount > 0).length;
  
  // Количество закрытых модулей
  const lockedModules = totalModules - modulesWithEnrollments;

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

      {/* Блок статистики по курсу */}
      <div className="stats-section">
        <h2 className="section-title">Статистика по курсу</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-large">📖</div>
            <div className="stat-content">
              <div className="stat-value">{totalModules}</div>
              <div className="stat-label">
                {totalModules === 1 ? 'Модуль' : totalModules < 5 ? 'Модуля' : 'Модулей'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-large">📝</div>
            <div className="stat-content">
              <div className="stat-value">{totalSteps}</div>
              <div className="stat-label">
                {totalSteps === 1 ? 'Шаг' : totalSteps < 5 ? 'Шага' : 'Шагов'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-large">👥</div>
            <div className="stat-content">
              <div className="stat-value">{uniqueLearners}</div>
              <div className="stat-label">
                {uniqueLearners === 1 ? 'Участник' : uniqueLearners < 5 ? 'Участника' : 'Участников'}
              </div>
              {uniqueLearners > 0 && (
                <div className="stat-hint">
                  Зарегистрировано в курсе
                </div>
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-large">🔓</div>
            <div className="stat-content">
              <div className="stat-value">{modulesWithEnrollments}</div>
              <div className="stat-label">
                {modulesWithEnrollments === 1 ? 'Модуль открыт' : modulesWithEnrollments < 5 ? 'Модуля открыто' : 'Модулей открыто'}
              </div>
              {lockedModules > 0 && (
                <div className="stat-hint">
                  🔒 {lockedModules} {lockedModules === 1 ? 'закрыт' : 'закрыто'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопка для открытия отчёта */}
      <div className="actions-section" style={{ marginBottom: '24px' }}>
        <button 
          className="btn btn-primary" 
          onClick={handleOpenReport}
          style={{ 
            width: '100%',
            padding: '12px 20px',
            fontSize: '16px',
            fontWeight: '600',
          }}
        >
          📊 Скачать отчёт по курсу
        </button>
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
              >
                <div className="module-card-content">
                  <div className="module-card-header">
                    <div className="module-title-wrapper">
                      <h3 className="module-card-title">
                        {module.isExam ? '🎓' : '📖'} {module.title}
                      </h3>
                      <div className="module-badges">
                        <span className="module-card-index">Модуль {module.index}</span>
                        {module.isExam && (
                          <span className="module-badge exam-badge">Экзамен</span>
                        )}
                      </div>
                    </div>
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

                  {/* Статус модуля */}
                  <div className="module-status">
                    {module.enrollmentsCount > 0 ? (
                      <div className="status-badge status-unlocked">
                        🔓 Открыт для {module.enrollmentsCount} {module.enrollmentsCount === 1 ? 'ученика' : module.enrollmentsCount < 5 ? 'учеников' : 'учеников'}
                      </div>
                    ) : (
                      <div className="status-badge status-locked">
                        🔒 Ни для кого не открыт
                      </div>
                    )}
                  </div>
                </div>

                <div className="module-card-actions">
                  <div className="module-actions-row">
                    {module.enrollmentsCount > 0 ? (
                      <button
                        className="btn-lock"
                        onClick={(e) => handleLockModule(module.id, e)}
                        disabled={lockingModuleId === module.id}
                      >
                        {lockingModuleId === module.id ? '🔄 Блокирую...' : '🔒 Заблокировать'}
                      </button>
                    ) : (
                      <button
                        className="btn-unlock"
                        onClick={(e) => handleUnlockModule(module.id, e)}
                        disabled={unlockingModuleId === module.id}
                      >
                        {unlockingModuleId === module.id ? '🔄 Открываю...' : '🔓 Открыть для всех'}
                      </button>
                    )}
                    <button
                      className="btn-edit"
                      onClick={(e) => handleEditModule(module.id, e)}
                    >
                      ✏️ Редактировать
                    </button>
                  </div>
                  <button
                    className={`btn-auto-unlock ${module.autoUnlockForNewLearners ? 'active' : ''}`}
                    onClick={(e) => handleToggleAutoUnlock(module.id, module.autoUnlockForNewLearners || false, e)}
                    disabled={settingAutoUnlock === module.id}
                  >
                    {settingAutoUnlock === module.id
                      ? '🔄 Сохраняю...'
                      : module.autoUnlockForNewLearners
                      ? '✅ Открывать для новых учеников'
                      : '➕ Открывать для новых учеников'}
                  </button>
                </div>
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

