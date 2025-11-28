import { useNavigate, useLocation } from 'react-router-dom';
import './CuratorTabs.css';

interface Tab {
  id: string;
  label: string;
  path: string;
}

const tabs: Tab[] = [
  { id: 'learners', label: '👥 Обучающиеся', path: '/curator' },
  { id: 'builder', label: '🛠️ Конструктор курса', path: '/curator/course' },
];

export function CuratorTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.path))?.id || 'learners';

  return (
    <div className="curator-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

