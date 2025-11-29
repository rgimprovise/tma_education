import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      // Проверяем, завершён ли профиль (регистрация через бота)
      if (!user.profileCompleted || !user.firstName || !user.lastName) {
        navigate('/incomplete-profile');
        return;
      }

      // Редирект в зависимости от роли
      if (user.role === 'CURATOR' || user.role === 'ADMIN') {
        navigate('/curator');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    // Получаем initData от Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      const initData = tg.initData;
      if (initData) {
        login(initData)
          .then(() => {
            // Редирект произойдёт автоматически через useEffect выше
          })
          .catch((error: any) => {
            console.error('Login failed:', error);
            setError(error.response?.data?.message || 'Ошибка авторизации');
          });
      } else {
        setError('Не удалось получить данные от Telegram');
      }
    } else {
      // Для разработки вне Telegram
      setError('Запустите приложение через Telegram');
    }
  }, [user, isLoading, login, navigate]);

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="loading">Авторизация...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-page">
        <div className="error-message">{error}</div>
        <p className="error-hint">
          Убедитесь, что вы открыли приложение через Telegram бота.
        </p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="loading">Авторизация...</div>
    </div>
  );
}

