import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Readable } from 'stream';

interface ReviewResult {
  score: number;
  feedback: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async reviewSubmission(
    taskContent: string,
    answerText: string,
    maxScore: number = 10,
    aiRubric?: string,
  ): Promise<ReviewResult> {
    // Если есть специфичные критерии для шага, используем их
    // Иначе используем общий промпт по принципу Минто
    const criteriaSection = aiRubric
      ? `Критерии оценки для этого задания:
${aiRubric}

`
      : `Оцени ответ обучающегося по следующим критериям:

1. **Главная мысль в начале** (0-3 балла)
   - Есть ли четкая главная мысль в начале текста?
   - Понятна ли она сразу?

2. **Структурированные опоры** (0-3 балла)
   - Есть ли 2-3 опоры одного типа?
   - Логично ли они сгруппированы?

3. **Детали и факты** (0-2 балла)
   - Подкреплены ли опоры конкретными деталями?
   - Есть ли иллюстрации и примеры?

4. **Применение SCQR** (0-2 балла, если применимо)
   - Четко ли выделены Situation, Complication, Question, Resolution?

`;

    const prompt = `Ты — эксперт по принципу пирамиды Минто и структурной коммуникации. 

${criteriaSection}**Максимальный балл: ${maxScore}**

Задание:
${taskContent}

Ответ обучающегося:
${answerText}

Верни ответ в формате JSON:
{
  "score": число от 0 до ${maxScore},
  "feedback": "развернутый комментарий на русском языке с конкретными рекомендациями"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'Ты эксперт по принципу пирамиды Минто. Всегда отвечай валидным JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        score: Math.min(Math.max(parsed.score || 0, 0), maxScore),
        feedback: parsed.feedback || content,
      };
    } catch (e) {
      // Если не JSON, пытаемся извлечь оценку из текста
      const scoreMatch = content.match(/[0-9]+(?:\.[0-9]+)?/);
      return {
        score: scoreMatch ? Math.min(parseFloat(scoreMatch[0]), maxScore) : 0,
        feedback: content,
      };
    }
  }

  /**
   * Транскрибация аудио/видео через OpenAI Whisper
   * @param audioBuffer - Buffer с аудио/видео файлом
   * @param filename - Имя файла (с расширением, например 'audio.ogg')
   * @returns Транскрибированный текст
   */
  async transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
    try {
      this.logger.log(`Starting transcription for file: ${filename}`);

      // Создаём File-like объект для OpenAI API
      const file = new File([audioBuffer], filename, {
        type: this.getMimeType(filename),
      });

      // Вызываем Whisper API
      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'ru', // Указываем русский язык для лучшей точности
        response_format: 'text',
      });

      this.logger.log(`Transcription completed: ${transcription.substring(0, 100)}...`);
      return transcription;
    } catch (error: any) {
      this.logger.error('Error transcribing audio:', error.message);
      throw new Error(`Ошибка транскрибации аудио: ${error.message}`);
    }
  }

  /**
   * Определяет MIME-type по расширению файла
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'mpeg': 'video/mpeg',
      'mpga': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
    };
    return mimeTypes[ext || ''] || 'audio/ogg';
  }
}

