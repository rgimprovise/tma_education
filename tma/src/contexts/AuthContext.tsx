import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  
  // Функция для проверки соответствия telegram_id
  const checkTelegramIdMatch = useCallback((userData: User): boolean => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) {
      const currentTelegramId = String(tg.initDataUnsafe.user.id);
      return currentTelegramId === userData.telegramId;
    }
    // Если initData недоступен, считаем что совпадает (для разработки вне Telegram)
    return true;
  }, []);

  const login = useCallback(async (initData: string) => {
    try {
      const response = await api.post('/auth/telegram-webapp', { initData });
      const { access_token, user: userData } = response.data;
      
      // Дополнительная проверка: убеждаемся, что telegram_id из ответа совпадает с текущим
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id) {
        const currentTelegramId = String(tg.initDataUnsafe.user.id);
        if (userData.telegramId !== currentTelegramId) {
          console.warn('Telegram ID mismatch after login:', {
            fromServer: userData.telegramId,
            fromInitData: currentTelegramId,
          });
          // Не блокируем логин, но логируем предупреждение
        }
      }
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Попытка восстановить сессию из localStorage
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      
      // Проверяем токен и загружаем пользователя
      api
        .get('/users/me')
        .then((response) => {
          const userData = response.data;
          
          // КРИТИЧЕСКИ ВАЖНО: Проверяем, соответствует ли сохранённый токен
          // текущему telegram_id из initData Telegram WebApp
          // Это необходимо для корректной работы при переключении между аккаунтами
          const telegramIdMatches = checkTelegramIdMatch(userData);
          
          if (!telegramIdMatches) {
            const tg = window.Telegram?.WebApp;
            const currentTelegramId = tg?.initDataUnsafe?.user?.id 
              ? String(tg.initDataUnsafe.user.id) 
              : 'unknown';
            
            console.log('Telegram ID mismatch detected. Clearing session and re-authenticating...', {
              current: currentTelegramId,
              saved: userData.telegramId,
            });
            
            // Очищаем старую сессию
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            delete api.defaults.headers.common['Authorization'];
            
            // Выполняем новый логин с текущим initData
            if (tg?.initData) {
              login(tg.initData)
                .catch((error) => {
                  console.error('Re-authentication failed:', error);
                })
                .finally(() => {
                  setIsLoading(false);
                });
              return;
            }
            
            setIsLoading(false);
            return;
          }
          
          // Если telegram_id совпадает или initData недоступен, используем сохранённого пользователя
          setUser(userData);
        })
        .catch(() => {
          // Токен невалиден, очищаем
          localStorage.removeItem('token');
          setToken(null);
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [checkTelegramIdMatch, login]);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
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

