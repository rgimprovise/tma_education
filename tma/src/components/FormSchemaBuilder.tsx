import { useState } from 'react';
import './FormSchemaBuilder.css';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'file';
  required: boolean;
}

interface FormSchemaBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FormSchemaBuilder({ fields, onChange }: FormSchemaBuilderProps) {
  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: '',
      type: 'textarea',
      required: false,
    };
    onChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    onChange(
      fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  return (
    <div className="form-schema-builder">
      {fields.length === 0 ? (
        <div className="empty-form">
          <p>Форма не задана. Будет использовано простое текстовое поле.</p>
          <button className="btn btn-secondary" onClick={addField}>
            ➕ Добавить поле
          </button>
        </div>
      ) : (
        <>
          {fields.map((field, index) => (
            <div key={field.id} className="form-field-editor">
              <div className="field-header">
                <span className="field-number">Поле {index + 1}</span>
                <button
                  className="delete-field-btn"
                  onClick={() => removeField(field.id)}
                  title="Удалить поле"
                >
                  🗑️
                </button>
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Название поля *</label>
                  <input
                    className="field-input"
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value })}
                    placeholder="Например: Главная мысль"
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Тип поля *</label>
                  <select
                    className="field-input"
                    value={field.type}
                    onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                  >
                    <option value="text">Текст (одна строка)</option>
                    <option value="textarea">Текст (многострочный)</option>
                    <option value="file">Файл</option>
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                  />
                  <span>Обязательное поле</span>
                </label>
              </div>
            </div>
          ))}

          <button className="btn btn-secondary" onClick={addField}>
            ➕ Добавить поле
          </button>
        </>
      )}
    </div>
  );
}

