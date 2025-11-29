import { useNavigate, useLocation } from 'react-router-dom';
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

  const tabs: Tab[] = [
    {
      id: 'courses',
      label: '📚 Курсы',
      path: '/curator/courses',
      matcher: /^\/curator\/courses/,
    },
    {
      id: 'learners',
      label: '👥 Обучающиеся',
      path: '/curator',
      matcher: /^\/curator\/users|^\/curator$/,
      excludeMatcher: /^\/curator\/course/, // Исключаем /curator/course*
    },
    {
      id: 'builder',
      label: '🔧 Конструктор',
      path: '/curator/course',
      matcher: /^\/curator\/course/,
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
  );
}

