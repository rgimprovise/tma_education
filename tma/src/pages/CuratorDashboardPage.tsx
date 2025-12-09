import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './CuratorDashboardPage.css';

interface Learner {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  enrollments: Array<{
    id: string;
    module: {
      id: string;
      index: number;
      title: string;
    };
    status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED';
  }>;
  totalSubmissions: number;
  pendingSubmissions: number;
  returnedSubmissions: number;
  resubmissionRequestedSubmissions: number;
}

type SortOption = 'name' | 'progress' | 'submissions' | 'pending' | 'returned' | 'resubmission';
type FilterOption = 'all' | 'pending' | 'returned' | 'resubmission' | 'completed';

const STORAGE_KEY = 'curator_learners_filters';

interface StoredFilters {
  sortBy: SortOption;
  filterBy: FilterOption;
  searchQuery: string;
}

function loadFiltersFromStorage(): StoredFilters {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sortBy: parsed.sortBy || 'name',
        filterBy: parsed.filterBy || 'all',
        searchQuery: parsed.searchQuery || '',
      };
    }
  } catch (e) {
    console.error('Failed to load filters from storage:', e);
  }
  return {
    sortBy: 'name',
    filterBy: 'all',
    searchQuery: '',
  };
}

function saveFiltersToStorage(filters: StoredFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Failed to save filters to storage:', e);
  }
}

export function CuratorDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Загружаем состояние из localStorage при инициализации
  const storedFilters = loadFiltersFromStorage();
  const [sortBy, setSortBy] = useState<SortOption>(storedFilters.sortBy);
  const [filterBy, setFilterBy] = useState<FilterOption>(storedFilters.filterBy);
  const [searchQuery, setSearchQuery] = useState<string>(storedFilters.searchQuery);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [learnersResponse, statsResponse] = await Promise.all([
          api.get('/admin/learners'),
          api.get('/admin/stats'),
        ]);
        setLearners(learnersResponse.data);
        setStats(statsResponse.data);
      } catch (err: any) {
        console.error('Failed to load data:', err);
        setError(err.response?.data?.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Сохраняем состояние при изменении фильтров
  useEffect(() => {
    saveFiltersToStorage({ sortBy, filterBy, searchQuery });
  }, [sortBy, filterBy, searchQuery]);

  // Функции сортировки и фильтрации
  const getFilteredAndSortedLearners = () => {
    let filtered = [...learners];

    // Поиск по имени
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((l) => {
        const fullName = `${l.firstName || ''} ${l.lastName || ''}`.trim().toLowerCase();
        const position = (l.position || '').toLowerCase();
        const telegramId = l.telegramId ? String(l.telegramId) : '';
        return (
          fullName.includes(query) ||
          position.includes(query) ||
          telegramId.includes(query)
        );
      });
    }

    // Фильтрация
    if (filterBy === 'pending') {
      filtered = filtered.filter((l) => l.pendingSubmissions > 0);
    } else if (filterBy === 'returned') {
      filtered = filtered.filter((l) => l.returnedSubmissions > 0);
    } else if (filterBy === 'resubmission') {
      filtered = filtered.filter((l) => l.resubmissionRequestedSubmissions > 0);
    } else if (filterBy === 'completed') {
      filtered = filtered.filter((l) => {
        const completedModules = l.enrollments.filter((e) => e.status === 'COMPLETED').length;
        return completedModules === l.enrollments.length && l.enrollments.length > 0;
      });
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Без имени';
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || 'Без имени';
          return nameA.localeCompare(nameB, 'ru');
        }
        case 'progress': {
          const progressA = a.enrollments.filter((e) => e.status === 'COMPLETED').length / Math.max(a.enrollments.length, 1);
          const progressB = b.enrollments.filter((e) => e.status === 'COMPLETED').length / Math.max(b.enrollments.length, 1);
          return progressB - progressA; // По убыванию
        }
        case 'submissions':
          return b.totalSubmissions - a.totalSubmissions; // По убыванию
        case 'pending':
          return b.pendingSubmissions - a.pendingSubmissions; // По убыванию
        case 'returned':
          return b.returnedSubmissions - a.returnedSubmissions; // По убыванию
        case 'resubmission':
          return b.resubmissionRequestedSubmissions - a.resubmissionRequestedSubmissions; // По убыванию
        default:
          return 0;
      }
    });

    return filtered;
  };

  const displayedLearners = getFilteredAndSortedLearners();

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Ученики</h1>
        <p className="page-subtitle">Добро пожаловать, {user?.firstName}!</p>
      </div>

      {/* Микро дэшборд со статистикой */}
      {stats && (
        <div className="stats-dashboard">
          <h2 className="section-title">Статистика</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon-large">👥</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalLearners}</div>
                <div className="stat-label">Всего учеников</div>
                <div className="stat-details">
                  Активных: {stats.activeLearners} | Завершили: {stats.completedLearners}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-large">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalSubmissions}</div>
                <div className="stat-label">Всего сдач</div>
                <div className="stat-details">
                  На проверке: {stats.pendingSubmissions} | Одобрено: {stats.approvedSubmissions}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-large">🔄</div>
              <div className="stat-content">
                <div className="stat-value">{stats.returnedSubmissions}</div>
                <div className="stat-label">Возвратов</div>
                <div className="stat-details">
                  Процент: {stats.returnRate.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-large">⭐</div>
              <div className="stat-content">
                <div className="stat-value">
                  {stats.averageCuratorScore !== null ? stats.averageCuratorScore.toFixed(1) : '—'}
                </div>
                <div className="stat-label">Средняя оценка</div>
                <div className="stat-details">
                  ИИ: {stats.averageAiScore !== null ? stats.averageAiScore.toFixed(1) : '—'}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-large">📈</div>
              <div className="stat-content">
                <div className="stat-value">{stats.averageCompletionRate.toFixed(1)}%</div>
                <div className="stat-label">Завершение курса</div>
                <div className="stat-details">
                  Модулей завершено: {stats.completedModulesCount}
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon-large">📋</div>
              <div className="stat-content">
                <div className="stat-value">{stats.learnersByProgress.inProgress}</div>
                <div className="stat-label">В процессе</div>
                <div className="stat-details">
                  Не начали: {stats.learnersByProgress.notStarted} | Завершили: {stats.learnersByProgress.completed}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Поиск, фильтры и сортировка */}
      <div className="filters-section">
        <div className="filter-group" style={{ flex: '1 1 100%', minWidth: '200px' }}>
          <label htmlFor="search-input" className="filter-label">Поиск:</label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени, должности, Telegram ID..."
            className="filter-select"
            style={{ width: '100%' }}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="sort-select" className="filter-label">Сортировка:</label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="filter-select"
          >
            <option value="name">По имени</option>
            <option value="progress">По прогрессу</option>
            <option value="submissions">По количеству сдач</option>
            <option value="pending">По сдачам на проверке</option>
            <option value="returned">По возвратам</option>
            <option value="resubmission">По запросам повторной отправки</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="filter-select" className="filter-label">Фильтр:</label>
          <select
            id="filter-select"
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            className="filter-select"
          >
            <option value="all">Все</option>
            <option value="pending">С на проверке</option>
            <option value="returned">С возвратами</option>
            <option value="resubmission">С запросами</option>
            <option value="completed">Завершившие курс</option>
          </select>
        </div>
      </div>

      <div className="learners-list">
        <h2 className="section-title">
          Участники ({displayedLearners.length} из {learners.length}):
        </h2>
        {displayedLearners.length === 0 ? (
            <div className="empty-state">
            <p>Нет участников по выбранным фильтрам</p>
            </div>
          ) : (
          displayedLearners.map((learner) => {
              const userName = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Без имени';
              const completedModules = learner.enrollments.filter((e) => e.status === 'COMPLETED').length;
              const totalModules = learner.enrollments.length;

              return (
                <div
                  key={learner.id}
                  className="card learner-card"
                  onClick={() => navigate(`/curator/users/${learner.id}`)}
                >
                  <div className="learner-card-header">
                    <div className="learner-main-info">
                      <div className="card-title">{userName}</div>
                      {learner.position && (
                        <div className="card-subtitle">{learner.position}</div>
                      )}
                    </div>
                    <div className="learner-badges">
                    {learner.pendingSubmissions > 0 && (
                        <div className="pending-badge" title="Сдачи на проверке">
                          ⏳ {learner.pendingSubmissions}
                        </div>
                      )}
                      {learner.returnedSubmissions > 0 && (
                        <div className="returned-badge" title="Возвращено на доработку">
                          🔄 {learner.returnedSubmissions}
                        </div>
                      )}
                      {learner.resubmissionRequestedSubmissions > 0 && (
                        <div className="resubmission-badge" title="Запрос на повторную отправку">
                          ❓ {learner.resubmissionRequestedSubmissions}
                      </div>
                    )}
                    </div>
                  </div>

                  <div className="learner-stats">
                    <div className="stat-item">
                      <span className="stat-icon">📖</span>
                      <span className="stat-text">
                        Модулей: <strong>{completedModules}/{totalModules}</strong> 
                        {completedModules > 0 && ` (${completedModules} завершено)`}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">📝</span>
                      <span className="stat-text">
                        Сдач: <strong>{learner.totalSubmissions}</strong>
                        {learner.pendingSubmissions > 0 && ` (${learner.pendingSubmissions} на проверке)`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </div>
  );
}

