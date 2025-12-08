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

interface LearnerEnrollment {
  module: {
    id: string;
    index: number;
    title: string;
  };
  status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface LearnerItem {
  id: string;
  telegramId?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  enrollments: LearnerEnrollment[];
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [learnersLoaded, setLearnersLoaded] = useState(false);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [unlockForLearnerModuleId, setUnlockForLearnerModuleId] = useState<string | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [searchLearner, setSearchLearner] = useState('');
  const [unlockingForLearner, setUnlockingForLearner] = useState(false);

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  // Закрытие меню экспорта при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

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

  const loadLearnersList = async () => {
    if (learnersLoaded || learnersLoading) return;
    try {
      setLearnersLoading(true);
      setLearnersError(null);
      const response = await api.get('/admin/learners');
      setLearners(response.data || []);
      setLearnersLoaded(true);
    } catch (err: any) {
      console.error('Failed to load learners list:', err);
      setLearnersError(err.response?.data?.message || 'Не удалось загрузить список учеников');
    } finally {
      setLearnersLoading(false);
    }
  };

  const handleOpenForLearner = async (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUnlockForLearnerModuleId(moduleId);
    setSelectedLearnerId(null);
    setSearchLearner('');
    await loadLearnersList();
  };

  const getEnrollmentStatus = (learner: LearnerItem, moduleId: string) => {
    const enrollment = learner.enrollments.find((enr) => enr.module.id === moduleId);
    return enrollment?.status || 'LOCKED';
  };

  const filteredLearners = learners.filter((learner) => {
    if (!searchLearner.trim()) return true;
    const query = searchLearner.trim().toLowerCase();
    const fullName = `${learner.firstName || ''} ${learner.lastName || ''}`.toLowerCase();
    const telegramId = learner.telegramId ? String(learner.telegramId) : '';
    const position = learner.position?.toLowerCase() || '';
    return (
      fullName.includes(query) ||
      telegramId.includes(query) ||
      position.includes(query)
    );
  });

  const handleUnlockForSelectedLearner = async () => {
    if (!unlockForLearnerModuleId || !selectedLearnerId) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Выберите ученика');
      } else {
        alert('Выберите ученика');
      }
      return;
    }

    try {
      setUnlockingForLearner(true);
      const response = await api.post(`/admin/modules/${unlockForLearnerModuleId}/unlock`, {
        userIds: [selectedLearnerId],
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          response.data.message || 'Модуль открыт для выбранного ученика'
        );
      } else {
        alert(response.data.message || 'Модуль открыт для выбранного ученика');
      }

      setUnlockForLearnerModuleId(null);
      setSelectedLearnerId(null);
      await loadCourseData();
    } catch (err: any) {
      console.error('Failed to unlock module for learner:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка при открытии для ученика';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setUnlockingForLearner(false);
    }
  };

  const handleBackToCourses = () => {
    navigate('/curator/courses');
  };

  const handleSendReportToTelegram = async () => {
    if (!courseId) return;

    try {
      await api.post(`/admin/courses/${courseId}/report/send-telegram`);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('✅ Отчёт отправлен в Telegram!');
      } else {
        alert('✅ Отчёт отправлен в Telegram!');
      }
    } catch (err: any) {
      console.error('Failed to send report to Telegram:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка отправки отчёта';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    }
  };

  const handleExport = async (format: 'csv' | 'tsv' | 'json') => {
    if (!courseId) return;

    try {
      setShowExportMenu(false);

      // Отправляем запрос на экспорт и отправку через Telegram
      const response = await api.post('/admin/export/send-telegram', {
        courseId,
        format,
        type: 'submissions',
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `✅ Экспорт отправлен в Telegram!\n\n` +
          `Формат: ${format.toUpperCase()}\n` +
          `Записей: ${response.data.rowsCount || 0}`
        );
      } else {
        alert(
          `✅ Экспорт отправлен в Telegram!\n\n` +
          `Формат: ${format.toUpperCase()}\n` +
          `Записей: ${response.data.rowsCount || 0}`
        );
      }
    } catch (err: any) {
      console.error('Failed to export data:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Ошибка экспорта данных';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(`❌ ${errorMessage}`);
      } else {
        alert(`❌ ${errorMessage}`);
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

      {/* Кнопки для экспорта и отправки отчёта */}
      <div className="actions-section" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSendReportToTelegram}
            style={{ 
              width: '100%',
              padding: '12px 20px',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            📤 Отправить отчёт в Telegram
          </button>
          
          <div className="export-menu-container" style={{ position: 'relative', width: '100%' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{ 
                width: '100%',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              📥 Экспорт данных {showExportMenu ? '▲' : '▼'}
            </button>
            
            {showExportMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                border: '1px solid var(--tg-theme-hint-color, rgba(0, 0, 0, 0.2))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                overflow: 'hidden',
              }}>
                <button
                  className="btn"
                  onClick={() => handleExport('csv')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  📄 CSV (Excel)
                </button>
                <button
                  className="btn"
                  onClick={() => handleExport('tsv')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    textAlign: 'left',
                    border: 'none',
                    borderBottom: '1px solid var(--tg-theme-hint-color, rgba(0, 0, 0, 0.1))',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  📄 TSV (Табуляция)
                </button>
                <button
                  className="btn"
                  onClick={() => handleExport('json')}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    textAlign: 'left',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  📄 JSON
                </button>
              </div>
            )}
          </div>
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
                    <button
                      className="btn-unlock-learner"
                      onClick={(e) => handleOpenForLearner(module.id, e)}
                      disabled={learnersLoading && unlockForLearnerModuleId === module.id}
                    >
                      🎯 Открыть ученику
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

      {unlockForLearnerModuleId && (
        <div className="modal-backdrop" onClick={() => setUnlockForLearnerModuleId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Открыть модуль ученику</h3>
              <button
                className="modal-close"
                onClick={() => setUnlockForLearnerModuleId(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-hint">
                Выберите тестового ученика, чтобы открыть доступ к модулю без открытия для всех.
              </div>

              <input
                type="text"
                className="modal-search"
                placeholder="Поиск по имени, должности или Telegram ID"
                value={searchLearner}
                onChange={(e) => setSearchLearner(e.target.value)}
              />

              {learnersError && (
                <div className="modal-error">{learnersError}</div>
              )}

              {learnersLoading ? (
                <div className="modal-loading">Загрузка списка учеников...</div>
              ) : (
                <div className="learner-list">
                  {filteredLearners.length === 0 ? (
                    <div className="empty-state small">Не найдено учеников</div>
                  ) : (
                    filteredLearners.map((learner) => {
                      const status = getEnrollmentStatus(learner, unlockForLearnerModuleId);
                      const name = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Без имени';
                      return (
                        <label
                          key={learner.id}
                          className={`learner-item ${selectedLearnerId === learner.id ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="selectedLearner"
                            value={learner.id}
                            checked={selectedLearnerId === learner.id}
                            onChange={() => setSelectedLearnerId(learner.id)}
                          />
                          <div className="learner-info">
                            <div className="learner-name">{name}</div>
                            <div className="learner-meta">
                              {learner.position && <span className="tag">{learner.position}</span>}
                              {learner.telegramId && <span className="tag">TG: {learner.telegramId}</span>}
                              <span className={`tag status-${status.toLowerCase()}`}>
                                {status === 'LOCKED' ? '🔒 Закрыт' : status === 'COMPLETED' ? '✅ Завершён' : '📚 В процессе'}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setUnlockForLearnerModuleId(null)}
              >
                Отмена
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUnlockForSelectedLearner}
                disabled={unlockingForLearner || learnersLoading}
              >
                {unlockingForLearner ? 'Открываю...' : 'Открыть ученику'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

