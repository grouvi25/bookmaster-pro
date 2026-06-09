import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { EVENT_TYPE_CONFIG, getEventTypeConfig } from './EventTypeChip';
import { Check, X, Plus, Pencil, Trash2 } from 'lucide-react';

const PRESET_KEYS = ['service', 'meeting', 'consultation', 'shooting', 'education', 'other'];

const EMOJI_OPTIONS = [
  '💅', '💇', '💆', '🏋️', '🎨', '🎵',
  '📱', '🔧', '🧹', '🐾', '🚗', '🏠',
  '📷', '✏️', '🎭', '🧘', '💉', '👶',
  '🌿', '🏷️', '💼', '🎯', '🛠️', '🧪',
];

interface CustomType {
  name: string;
  emoji: string;
}

interface Props {
  value: string;
  onChange: (type: string) => void;
  customTypes: CustomType[];
  onCreateCustom: (ct: CustomType) => void;
  onUpdateCustom: (idx: number, ct: CustomType) => void;
  onDeleteCustom: (idx: number) => void;
  className?: string;
}

export default function EventTypePicker({
  value,
  onChange,
  customTypes,
  onCreateCustom,
  onUpdateCustom,
  onDeleteCustom,
  className,
}: Props) {
  const [inputMode, setInputMode] = useState<'create' | 'edit' | null>(null);
  const [editIdx, setEditIdx] = useState(-1);
  const [inputName, setInputName] = useState('');
  const [inputEmoji, setInputEmoji] = useState('🏷️');
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  const startCreate = () => {
    setInputMode('create');
    setInputName('');
    setInputEmoji('🏷️');
    setEditIdx(-1);
    setShowEmojiGrid(false);
  };

  const startEdit = (idx: number) => {
    setInputMode('edit');
    setEditIdx(idx);
    setInputName(customTypes[idx].name);
    setInputEmoji(customTypes[idx].emoji);
    setShowEmojiGrid(false);
  };

  const cancelInput = () => {
    setInputMode(null);
    setEditIdx(-1);
    setInputName('');
    setShowEmojiGrid(false);
  };

  const confirmInput = () => {
    const name = inputName.trim();
    if (!name) return;
    if (inputMode === 'create') {
      onCreateCustom({ name, emoji: inputEmoji });
      // Auto-select the new type
      onChange(name);
    } else if (inputMode === 'edit' && editIdx >= 0) {
      onUpdateCustom(editIdx, { name, emoji: inputEmoji });
      // If the edited type was selected, update selection
      if (value === customTypes[editIdx].name) {
        onChange(name);
      }
    }
    cancelInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmInput();
    if (e.key === 'Escape') cancelInput();
  };

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5">
        {/* Preset chips */}
        {PRESET_KEYS.map((key) => {
          const config = EVENT_TYPE_CONFIG[key];
          if (!config) return null;
          const isActive = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-card text-xs font-medium',
                'transition-all duration-150 active:scale-95',
                isActive
                  ? 'bg-brand-500 text-white shadow-button'
                  : 'bg-tg-secondary text-tg-text',
              )}
            >
              <span>{config.emoji}</span>
              {config.label}
            </button>
          );
        })}

        {/* Custom chips */}
        {customTypes.map((ct, idx) => {
          const isActive = value === ct.name;
          const isEditing = inputMode === 'edit' && editIdx === idx;
          if (isEditing) return null; // replaced by input below
          return (
            <div key={`custom-${idx}`} className="relative group">
              <button
                type="button"
                onClick={() => onChange(ct.name)}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-card text-xs font-medium',
                  'transition-all duration-150 active:scale-95',
                  isActive
                    ? 'bg-brand-500 text-white shadow-button'
                    : 'bg-tg-secondary text-tg-text',
                )}
              >
                <span>{ct.emoji}</span>
                {ct.name}
              </button>
              {/* Edit/delete controls — visible on active */}
              {isActive && !inputMode && (
                <div className="flex gap-1 mt-1 justify-center">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); startEdit(idx); }}
                    className="p-1 rounded-lg bg-tg-secondary text-tg-hint active:scale-90 transition-transform"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCustom(idx);
                      if (value === ct.name) onChange('service');
                    }}
                    className="p-1 rounded-lg bg-status-error/10 text-status-error active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* "Своё+" button */}
        {!inputMode && (
          <button
            type="button"
            onClick={startCreate}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-card text-xs font-medium',
              'bg-tg-secondary text-tg-hint border border-dashed border-tg-hint/30',
              'transition-all duration-150 active:scale-95',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Своё
          </button>
        )}
      </div>

      {/* Inline input for create/edit */}
      {inputMode && (
        <div className="bg-surface-elevated rounded-card p-3 animate-slide-up">
          <div className="flex items-center gap-2">
            {/* Emoji button */}
            <button
              type="button"
              onClick={() => setShowEmojiGrid(!showEmojiGrid)}
              className="w-10 h-10 flex items-center justify-center rounded-card bg-tg-secondary text-lg active:scale-90 transition-transform flex-shrink-0"
            >
              {inputEmoji}
            </button>

            {/* Name input */}
            <input
              ref={inputRef}
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Название типа…"
              maxLength={30}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-card bg-tg-secondary text-sm text-tg-text outline-none placeholder:text-tg-hint/50"
            />

            {/* Cancel */}
            <button
              type="button"
              onClick={cancelInput}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-tg-secondary text-tg-hint active:scale-90 transition-transform flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Confirm */}
            <button
              type="button"
              onClick={confirmInput}
              disabled={!inputName.trim()}
              className={clsx(
                'w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0',
                inputName.trim()
                  ? 'bg-brand-500 text-white'
                  : 'bg-tg-secondary text-tg-hint/30',
              )}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>

          {/* Emoji grid */}
          {showEmojiGrid && (
            <div className="grid grid-cols-8 gap-1 mt-2 p-2 bg-tg-secondary rounded-card">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setInputEmoji(em); setShowEmojiGrid(false); }}
                  className={clsx(
                    'w-9 h-9 flex items-center justify-center rounded-lg text-lg',
                    'active:scale-90 transition-all duration-100',
                    inputEmoji === em ? 'bg-brand-500/20 scale-110' : 'hover:bg-tg-bg',
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
