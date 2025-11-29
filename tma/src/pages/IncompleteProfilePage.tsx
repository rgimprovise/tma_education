import './IncompleteProfilePage.css';

export function IncompleteProfilePage() {
  const handleBackToBot = () => {
    // Закрываем WebApp и возвращаем в чат с ботом
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    }
  };

  return (
    <div className="incomplete-profile-page">
      <div className="incomplete-profile-content">
        <div className="icon-large">📝</div>
        <h1 className="title">Завершите регистрацию</h1>
        <p className="description">
          Регистрация проходит через чат с ботом.
        </p>
        <div className="instructions">
          <p className="instruction-step">
            1. Вернитесь в диалог с ботом
          </p>
          <p className="instruction-step">
            2. Отправьте команду <code>/start</code>
          </p>
          <p className="instruction-step">
            3. Ответьте на вопросы (имя, фамилия, должность)
          </p>
          <p className="instruction-step">
            4. После завершения регистрации вернитесь сюда и обновите приложение
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleBackToBot}>
          Вернуться в чат с ботом
        </button>
      </div>
    </div>
  );
}

