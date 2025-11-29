import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './CuratorTabBar.css';

interface Tab {
  id: string;
  label: string;
  path: string;
  matcher: RegExp;
  excludeMatcher?: RegExp;
}

export function CuratorTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showConfirm(
        'Вы уверены, что хотите выйти? Это очистит все данные приложения.',
        (confirmed) => {
          if (confirmed) {
            logout();
            window.location.reload();
          }
        }
      );
    } else {
      if (confirm('Вы уверены, что хотите выйти?')) {
        logout();
        window.location.reload();
      }
    }
  };

  const tabs: Tab[] = [
    {
      id: 'courses',
      label: '📚 Курсы',
      path: '/curator/courses',
      matcher: /^\/curator\/courses/,
    },
    {
      id: 'learners',
      label: '👥 Ученики',
      path: '/curator',
      matcher: /^\/curator\/users|^\/curator$/,
      excludeMatcher: /^\/curator\/course/, // Исключаем /curator/course*
    },
    {
      id: 'builder',
      label: '🔧 Конструктор',
      path: '/curator/course-builder',
      matcher: /^\/curator\/course-builder|^\/curator\/course/,
    },
  ];

  const isActive = (tab: Tab) => {
    const matches = tab.matcher.test(location.pathname);
    if (!matches) return false;
    if (tab.excludeMatcher && tab.excludeMatcher.test(location.pathname)) {
      return false;
    }
    return true;
  };

  return (
    <div className="curator-tab-bar">
      <div className="tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${isActive(tab) ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button className="logout-button" onClick={handleLogout} title="Выйти">
        🚪
      </button>
    </div>
  );
}

