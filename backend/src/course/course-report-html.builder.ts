import { CourseReportData } from './dto/course-report.dto';

/**
 * Построить HTML-отчёт по курсу
 */
export function buildCourseReportHtml(report: CourseReportData): string {
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Отчёт по курсу: ${escapeHtml(report.course.title)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 28px;
    }
    
    h2 {
      color: #34495e;
      margin-top: 30px;
      margin-bottom: 15px;
      font-size: 22px;
      border-bottom: 2px solid #3498db;
      padding-bottom: 8px;
    }
    
    h3 {
      color: #555;
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 18px;
    }
    
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .kpi {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    
    .kpi-value {
      font-size: 32px;
      font-weight: bold;
      color: #3498db;
      margin-bottom: 5px;
    }
    
    .kpi-label {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: white;
    }
    
    th {
      background: #3498db;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #dee2e6;
      font-size: 14px;
    }
    
    tr:hover {
      background: #f8f9fa;
    }
    
    .tag {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .badge-ok {
      background: #d4edda;
      color: #155724;
    }
    
    .badge-warn {
      background: #fff3cd;
      color: #856404;
    }
    
    .badge-bad {
      background: #f8d7da;
      color: #721c24;
    }
    
    .badge-info {
      background: #d1ecf1;
      color: #0c5460;
    }
    
    .problems-list {
      list-style: none;
      margin-left: 0;
    }
    
    .problems-list li {
      padding: 10px;
      margin-bottom: 10px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
    }
    
    .problems-list li strong {
      color: #856404;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .module-group {
      margin-bottom: 30px;
    }
    
    .module-header {
      background: #e9ecef;
      padding: 10px 15px;
      font-weight: 600;
      border-radius: 4px 4px 0 0;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${buildHeader(report)}
    ${buildSummary(report)}
    ${buildModulesTable(report)}
    ${buildProblems(report)}
    ${buildLearnersProgress(report)}
    ${buildStepsTable(report)}
    ${buildFooter()}
  </div>
</body>
</html>
  `;
  
  return html.trim();
}

/**
 * Построить шапку курса
 */
function buildHeader(report: CourseReportData): string {
  const period = report.course.learningPeriod;
  const periodText = period && period.start && period.end
    ? `${formatDate(period.start)} — ${formatDate(period.end)}`
    : 'Не указан';
  
  return `
    <div class="section">
      <h1>${escapeHtml(report.course.title)}</h1>
      ${report.course.description ? `<p class="meta">${escapeHtml(report.course.description)}</p>` : ''}
      <div class="meta">
        <strong>Модулей:</strong> ${report.course.modulesCount} | 
        <strong>Шагов:</strong> ${report.course.stepsCount} (обязательных: ${report.course.requiredStepsCount}) | 
        <strong>Период обучения:</strong> ${periodText} | 
        <strong>Дата генерации:</strong> ${formatDate(new Date())}
      </div>
    </div>
  `;
}

/**
 * Построить общую сводку (KPI)
 */
function buildSummary(report: CourseReportData): string {
  const stats = report.stats;
  
  return `
    <div class="section">
      <h2>Общая сводка по курсу</h2>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-value">${stats.totalLearners}</div>
          <div class="kpi-label">Всего участников</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats.startedLearners}</div>
          <div class="kpi-label">Начали обучение</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats.completedLearners}</div>
          <div class="kpi-label">Завершили курс</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${formatPercent(stats.avgCompletionPercent)}</div>
          <div class="kpi-label">Средний % завершения</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats.avgCompletionTime ? formatDays(stats.avgCompletionTime) : '—'}</div>
          <div class="kpi-label">Среднее время (дни)</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${stats.totalSubmissions}</div>
          <div class="kpi-label">Всего сдач</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Построить таблицу по модулям
 */
function buildModulesTable(report: CourseReportData): string {
  const rows = report.modules.map(module => {
    const completionBadge = getCompletionBadge(module.enrollmentStats.completionRate);
    const timeText = module.timeStats?.avgTimeToComplete 
      ? formatDays(module.timeStats.avgTimeToComplete)
      : '—';
    
    return `
      <tr>
        <td>${module.module.index}</td>
        <td>
          ${escapeHtml(module.module.title)}
          ${module.module.isExam ? ' <span class="tag badge-info">Экзамен</span>' : ''}
        </td>
        <td>${module.module.stepsCount} (${module.module.requiredStepsCount})</td>
        <td>${module.enrollmentStats.inProgress} / ${module.enrollmentStats.completed}</td>
        <td class="text-center">${completionBadge}</td>
        <td class="text-center">${timeText}</td>
        <td class="text-center">${module.submissionStats.total}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div class="section">
      <h2>Таблица по модулям</h2>
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Название</th>
            <th>Шагов (обязательных)</th>
            <th>В процессе / Завершено</th>
            <th>% завершения</th>
            <th>Среднее время</th>
            <th>Сдач</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Построить проблемные зоны
 */
function buildProblems(report: CourseReportData): string {
  // Проблемные модули и шаги
  const moduleStepProblems = report.problems.length > 0
    ? report.problems.map(problem => {
        const issues = problem.issues.map(issue => {
          if (issue.lowCompletionRate) {
            return `Низкий процент завершения: ${formatPercent(issue.lowCompletionRate.rate)}% (порог: ${issue.lowCompletionRate.threshold}%)`;
          }
          if (issue.highReturnsPercent) {
            return `Высокий процент возвратов: ${formatPercent(issue.highReturnsPercent.percent)}% (порог: ${issue.highReturnsPercent.threshold}%)`;
          }
          if (issue.lowAvgScore) {
            return `Низкий средний балл: ${issue.lowAvgScore.score.toFixed(1)}/10 (порог: ${issue.lowAvgScore.threshold})`;
          }
          return '';
        }).filter(Boolean).join('; ');
        
        const typeLabel = problem.type === 'module' ? 'Модуль' : 'Шаг';
        
        return `
          <li>
            <strong>${typeLabel} ${problem.index}: ${escapeHtml(problem.title)}</strong><br>
            ${issues}
          </li>
        `;
      }).join('')
    : '<li>Проблемных модулей и шагов не обнаружено.</li>';

  // Проблемные ученики (низкие оценки или возвращенные работы)
  const problemLearners = report.learnersProgress
    ? report.learnersProgress.filter(learner => 
        learner.returnedSubmissions > 0 || learner.lowScores.length > 0
      )
    : [];

  const learnerProblems = problemLearners.length > 0
    ? problemLearners.map(learner => {
        const fullName = `${learner.firstName} ${learner.lastName}`.trim() || 'Не указано';
        const issues: string[] = [];
        
        if (learner.returnedSubmissions > 0) {
          issues.push(`Возвращено работ: ${learner.returnedSubmissions}`);
          if (learner.returnedSteps.length > 0) {
            const stepsList = learner.returnedSteps
              .slice(0, 3)
              .map(s => `М${s.moduleIndex}.${s.stepIndex} ${s.stepTitle}`)
              .join(', ');
            issues.push(`Шаги: ${stepsList}${learner.returnedSteps.length > 3 ? '...' : ''}`);
          }
        }
        
        if (learner.lowScores.length > 0) {
          issues.push(`Низкие оценки: ${learner.lowScores.length} работ`);
          const lowScoresList = learner.lowScores
            .slice(0, 3)
            .map(s => `М${s.moduleIndex}.${s.stepIndex} (${s.score.toFixed(1)})`)
            .join(', ');
          issues.push(`Примеры: ${lowScoresList}${learner.lowScores.length > 3 ? '...' : ''}`);
        }
        
        if (learner.avgScore !== null && learner.avgScore < 6) {
          issues.push(`Средний балл ниже 6: ${learner.avgScore.toFixed(1)}`);
        }
        
        return `
          <li>
            <strong style="font-size: 16px; color: #721c24;">👤 ${escapeHtml(fullName)}</strong><br>
            ${issues.join('; ')}
          </li>
        `;
      }).join('')
    : '<li>Проблемных учеников не обнаружено.</li>';

  return `
    <div class="section">
      <h2>Проблемные зоны</h2>
      
      <h3>Модули и шаги</h3>
      <ul class="problems-list">
        ${moduleStepProblems}
      </ul>
      
      <h3>Ученики с проблемами</h3>
      <ul class="problems-list">
        ${learnerProblems}
      </ul>
    </div>
  `;
}

/**
 * Построить подробную таблицу по шагам
 */
function buildStepsTable(report: CourseReportData): string {
  const moduleGroups = report.modules.map(module => {
    const rows = module.steps.map(step => {
      const completionBadge = getCompletionBadge(step.completionRate);
      const returnsBadge = getReturnsBadge(step.submissionStats.returnsPercent);
      const aiScore = step.scores.avgAiScore !== null ? step.scores.avgAiScore.toFixed(1) : '—';
      const curatorScore = step.scores.avgCuratorScore !== null ? step.scores.avgCuratorScore.toFixed(1) : '—';
      
      return `
        <tr>
          <td>${step.step.index}</td>
          <td>${escapeHtml(step.step.title)}</td>
          <td><span class="tag badge-info">${step.step.type}</span></td>
          <td class="text-center">${step.step.isRequired ? '✓' : '—'}</td>
          <td class="text-center">${completionBadge}</td>
          <td class="text-center">${step.submissionStats.total}</td>
          <td class="text-center">${aiScore}</td>
          <td class="text-center">${curatorScore}</td>
          <td class="text-center">${returnsBadge}</td>
        </tr>
      `;
    }).join('');
    
    return `
      <div class="module-group">
        <div class="module-header">
          Модуль ${module.module.index}: ${escapeHtml(module.module.title)}
        </div>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Название</th>
              <th>Тип</th>
              <th>Обязательный</th>
              <th>% завершения</th>
              <th>Сдач</th>
              <th>ИИ балл</th>
              <th>Куратор балл</th>
              <th>% возвратов</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
  
  return `
    <div class="section">
      <h2>Подробная таблица по шагам</h2>
      ${moduleGroups}
    </div>
  `;
}

/**
 * Построить список всех учеников с прогрессом
 */
function buildLearnersProgress(report: CourseReportData): string {
  if (!report.learnersProgress || report.learnersProgress.length === 0) {
    return `
      <div class="section">
        <h2>Список учеников</h2>
        <p>Данных по ученикам нет.</p>
      </div>
    `;
  }

  const rows = report.learnersProgress.map(learner => {
    const fullName = `${learner.firstName || ''} ${learner.lastName || ''}`.trim() || 'Не указано';
    const position = learner.position || '—';
    const avgScore = learner.avgScore !== null ? learner.avgScore.toFixed(1) : '—';
    const scoreBadge = learner.avgScore !== null && learner.avgScore < 6
      ? '<span class="tag badge-bad">Низкий</span>'
      : learner.avgScore !== null && learner.avgScore >= 8
      ? '<span class="tag badge-ok">Высокий</span>'
      : '';
    
    const hasProblems = learner.returnedSubmissions > 0 || learner.lowScores.length > 0;
    const problemBadge = hasProblems ? '<span class="tag badge-warn">⚠️ Проблемы</span>' : '';

    return `
      <tr>
        <td><strong>${escapeHtml(fullName)}</strong></td>
        <td>${escapeHtml(position)}</td>
        <td class="text-center">${learner.modulesCompleted}</td>
        <td class="text-center">${learner.modulesInProgress}</td>
        <td class="text-center">${learner.totalSubmissions}</td>
        <td class="text-center">${learner.approvedSubmissions}</td>
        <td class="text-center">${learner.returnedSubmissions > 0 ? `<span class="tag badge-warn">${learner.returnedSubmissions}</span>` : '0'}</td>
        <td class="text-center">${avgScore} ${scoreBadge}</td>
        <td class="text-center">${problemBadge}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>Список всех учеников</h2>
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Должность</th>
            <th>Завершено модулей</th>
            <th>В процессе</th>
            <th>Всего сдач</th>
            <th>Одобрено</th>
            <th>Возвращено</th>
            <th>Средний балл</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Построить футер
 */
function buildFooter(): string {
  return `
    <div class="footer">
      Отчёт сгенерирован системой обучения «Пирамида Минто»<br>
      ${formatDate(new Date())}
    </div>
  `;
}

/**
 * Получить badge для процента завершения
 */
function getCompletionBadge(percent: number): string {
  if (percent >= 80) {
    return `<span class="tag badge-ok">${formatPercent(percent)}</span>`;
  } else if (percent >= 50) {
    return `<span class="tag badge-warn">${formatPercent(percent)}</span>`;
  } else {
    return `<span class="tag badge-bad">${formatPercent(percent)}</span>`;
  }
}

/**
 * Получить badge для процента возвратов
 */
function getReturnsBadge(percent: number): string {
  if (percent <= 10) {
    return `<span class="tag badge-ok">${formatPercent(percent)}</span>`;
  } else if (percent <= 30) {
    return `<span class="tag badge-warn">${formatPercent(percent)}</span>`;
  } else {
    return `<span class="tag badge-bad">${formatPercent(percent)}</span>`;
  }
}

/**
 * Форматировать процент
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Форматировать дни
 */
function formatDays(days: number): string {
  return `${days.toFixed(1)} дн.`;
}

/**
 * Форматировать дату
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Экранировать HTML
 */
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

