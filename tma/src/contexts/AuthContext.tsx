import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  telegramId: string;
  firstName?: string;
  lastName?: string;
  role: 'LEARNER' | 'CURATOR' | 'ADMIN';
  profileCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (initData: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверяем, не сменился ли пользователь Telegram
    const currentTelegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
    const savedTelegramId = localStorage.getItem('telegram_id');
    
    // Если Telegram ID изменился - очищаем всё (смена аккаунта)
    if (currentTelegramId && savedTelegramId && currentTelegramId !== savedTelegramId) {
      console.log('Telegram user changed, clearing auth data');
      localStorage.clear();
      setToken(null);
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
      setIsLoading(false);
      return;
    }
    
    // Попытка восстановить сессию из localStorage
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      
      // Проверяем токен и загружаем пользователя
      api
        .get('/users/me')
        .then((response) => {
          setUser(response.data);
          // Сохраняем Telegram ID для проверки при следующем запуске
          if (currentTelegramId) {
            localStorage.setItem('telegram_id', currentTelegramId);
          }
        })
        .catch(() => {
          // Токен невалиден, очищаем
          localStorage.clear();
          setToken(null);
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (initData: string) => {
    try {
      const response = await api.post('/auth/telegram-webapp', { initData });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      
      // Сохраняем Telegram ID для проверки при следующем запуске
      const currentTelegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
      if (currentTelegramId) {
        localStorage.setItem('telegram_id', currentTelegramId);
      }
      
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear(); // Очищаем всё, включая telegram_id
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

