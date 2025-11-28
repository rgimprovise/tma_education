import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Submission {
  id: string;
  answerText?: string;
  aiScore?: number;
  aiFeedback?: string;
  curatorScore?: number;
  curatorFeedback?: string;
  status: string;
  step: {
    title: string;
  };
  module: {
    index: number;
  };
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    api.get('/submissions').then((response) => {
      setSubmissions(response.data);
    });
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      <h1>Мои сдачи</h1>

      {submissions.length === 0 ? (
        <p>У вас пока нет сдач</p>
      ) : (
        submissions.map((submission) => (
          <div
            key={submission.id}
            style={{
              padding: '16px',
              marginBottom: '12px',
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
          >
            <h3>
              Модуль {submission.module.index} - {submission.step.title}
            </h3>
            <p>Статус: {submission.status}</p>
            {submission.aiScore !== null && (
              <p>Оценка ИИ: {submission.aiScore}/10</p>
            )}
            {submission.aiFeedback && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5' }}>
                <strong>Комментарий ИИ:</strong>
                <p>{submission.aiFeedback}</p>
              </div>
            )}
            {submission.curatorScore !== null && (
              <p>Оценка куратора: {submission.curatorScore}/10</p>
            )}
            {submission.curatorFeedback && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e8f5e9' }}>
                <strong>Комментарий куратора:</strong>
                <p>{submission.curatorFeedback}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

