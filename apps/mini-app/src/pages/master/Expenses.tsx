import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import EmptyState from '@/shared/ui/EmptyState';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import { toast } from '@/shared/ui/Toast';
import { ServiceCardSkeleton } from '@/shared/ui/Skeleton';
import { HeaderBackButton } from '@/components/common/BackButton';
import { Plus, Trash2, Pencil, X, Check, Mic, MicOff, Camera, TrendingDown, TrendingUp } from 'lucide-react';
import api from '@/api/client';

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  materials: { label: 'Материалы', emoji: '🧴' },
  rent: { label: 'Аренда', emoji: '🏠' },
  transport: { label: 'Транспорт', emoji: '🚗' },
  equipment: { label: 'Оборудование', emoji: '🔧' },
  education: { label: 'Обучение', emoji: '📚' },
  marketing: { label: 'Маркетинг', emoji: '📢' },
  subscriptions: { label: 'Подписки', emoji: '💳' },
  other: { label: 'Прочее', emoji: '📦' },
};

interface Expense {
  id: number;
  amount: number;
  category: string;
  description?: string;
  expense_date: string;
  source: string;
  receipt_url?: string;
  created_at: string;
}

interface ExpenseStats {
  total_month: number;
  total_prev_month: number;
  by_category: Record<string, number>;
  count_month: number;
}

type InputMode = 'manual' | 'voice' | 'receipt' | 'receipt_photo';

export default function Expenses() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [filterYear] = useState(now.getFullYear());
  const [filterMonth] = useState(now.getMonth() + 1);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [formSource, setFormSource] = useState<InputMode>('manual');
  const [formLoading, setFormLoading] = useState(false);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Receipt upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptProcessing, setReceiptProcessing] = useState(false);

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', filterYear, filterMonth],
    queryFn: () =>
      expensesApi.list(filterYear, filterMonth).then((r) => r.data),
  });

  const { data: stats } = useQuery<ExpenseStats>({
    queryKey: ['expense-stats'],
    queryFn: () => expensesApi.stats().then((r) => r.data),
  });

  const resetForm = () => {
    setFormAmount('');
    setFormCategory('other');
    setFormDescription('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormSource('manual');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setFormAmount(String(Number(e.amount)));
    setFormCategory(e.category);
    setFormDescription(e.description || '');
    setFormDate(e.expense_date);
    setFormSource('manual');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formAmount || Number(formAmount) <= 0) {
      toast.error('Введите сумму');
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        amount: Number(formAmount),
        category: formCategory,
        description: formDescription.trim() || undefined,
        expense_date: formDate || undefined,
        source: formSource,
      };
      if (editingId) {
        await expensesApi.update(editingId, payload);
        toast.success('Расход обновлён');
      } else {
        await expensesApi.create(payload);
        toast.success('Расход добавлен');
      }
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      resetForm();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await expensesApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      toast.success('Расход удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  // ── Voice recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceProcessing(true);
        try {
          // 1. Transcribe
          const formData = new FormData();
          formData.append('audio', blob, 'expense.webm');
          const transcribeResp = await api.post('/ai/transcribe', formData);
          const transcript = transcribeResp.data.transcript;
          if (!transcript) {
            toast.error('Не удалось распознать речь');
            return;
          }
          // 2. Parse expense from transcript
          const parseResp = await api.post('/expenses/parse-voice', { transcript });
          const parsed = parseResp.data;
          if (parsed.amount) {
            setFormAmount(String(parsed.amount));
            setFormCategory(parsed.category || 'other');
            setFormDescription(parsed.description || transcript);
            if (parsed.expense_date) setFormDate(parsed.expense_date);
            setFormSource('voice');
            setShowForm(true);
            toast.success('Расход распознан — проверь и сохрани');
          } else {
            toast.error('Не удалось распознать расход');
          }
        } catch {
          toast.error('Ошибка обработки записи');
        } finally {
          setVoiceProcessing(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error('Нет доступа к микрофону');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  // ── Receipt photo ──
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await api.post('/expenses/parse-receipt', formData);
      const parsed = resp.data;
      if (parsed.amount) {
        setFormAmount(String(parsed.amount));
        setFormCategory(parsed.category || 'other');
        const desc = parsed.description || (parsed.items?.map((i: { name: string }) => i.name).join(', '));
        setFormDescription(desc || '');
        if (parsed.expense_date) setFormDate(parsed.expense_date);
        setFormSource('receipt_photo');
        setShowForm(true);
        toast.success('Чек распознан — проверь и сохрани');
      } else {
        toast.error('Не удалось распознать чек');
      }
    } catch {
      toast.error('Ошибка обработки чека');
    } finally {
      setReceiptProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const monthDiff = stats
    ? stats.total_month - stats.total_prev_month
    : 0;

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  return (
    <div className="px-screen-x pb-24">
      <HeaderBackButton />
      <PageHeader title="Расходы" />

      {/* ── Stats Card ── */}
      {stats && (
        <Card className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-body font-medium">{monthNames[filterMonth - 1]}</div>
            <div className="text-h3 font-bold">
              {Number(stats.total_month).toLocaleString('ru')} ₽
            </div>
          </div>
          {stats.total_prev_month > 0 && (
            <div className={`flex items-center gap-1 text-xs ${monthDiff > 0 ? 'text-status-danger' : 'text-status-success'}`}>
              {monthDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {monthDiff > 0 ? '+' : ''}{Number(monthDiff).toLocaleString('ru')} ₽ vs прошлый месяц
            </div>
          )}
          {Object.keys(stats.by_category).length > 0 && (
            <div className="mt-3 pt-3 border-t border-tg-secondary flex flex-wrap gap-2">
              {Object.entries(stats.by_category)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, amount]) => (
                  <span key={cat} className="text-xs text-tg-hint">
                    {CATEGORIES[cat]?.emoji || '📦'} {Number(amount).toLocaleString('ru')} ₽
                  </span>
                ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="flex items-center gap-1 text-tg-link text-sm"
        >
          {showForm && !editingId ? <><X className="w-4 h-4" /> Отмена</> : <><Plus className="w-4 h-4" /> Добавить</>}
        </button>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={voiceProcessing}
          className={`flex items-center gap-1 text-sm ${recording ? 'text-status-danger animate-pulse' : 'text-tg-link'}`}
        >
          {recording ? <><MicOff className="w-4 h-4" /> Стоп</> : <><Mic className="w-4 h-4" /> Голос</>}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={receiptProcessing}
          className="flex items-center gap-1 text-tg-link text-sm"
        >
          <Camera className="w-4 h-4" /> Чек
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleReceiptUpload}
        />
      </div>

      {/* Processing indicators */}
      {voiceProcessing && (
        <Card className="mb-4 animate-pulse text-center text-sm text-tg-hint">
          🎙 Распознаю голос...
        </Card>
      )}
      {receiptProcessing && (
        <Card className="mb-4 animate-pulse text-center text-sm text-tg-hint">
          📸 Распознаю чек...
        </Card>
      )}

      {/* ── Form ── */}
      {showForm && (
        <Card className="mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-sm">
              {editingId ? 'Редактирование' : 'Новый расход'}
            </span>
            <button onClick={resetForm} className="text-tg-hint p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="Сумма ₽"
              type="number"
              inputMode="decimal"
              className="input-field"
            />
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="input-field"
            >
              {Object.entries(CATEGORIES).map(([key, { label, emoji }]) => (
                <option key={key} value={key}>{emoji} {label}</option>
              ))}
            </select>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              className="input-field"
            />
            <input
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              type="date"
              className="input-field"
            />
            <Button onClick={handleSubmit} loading={formLoading} fullWidth size="sm">
              <Check className="w-4 h-4 mr-1" />
              {editingId ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </Card>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <ServiceCardSkeleton count={4} />
      ) : !expenses || expenses.length === 0 ? (
        <EmptyState emoji="💰" title="Нет расходов" description="Добавь первый расход" />
      ) : (
        <div className="flex flex-col gap-2">
          {expenses.map((e) => {
            const cat = CATEGORIES[e.category] || CATEGORIES.other;
            return (
              <Card key={e.id} className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {e.description || cat.label}
                  </div>
                  <div className="text-xs text-tg-hint">
                    {new Date(e.expense_date).toLocaleDateString('ru')}
                    {e.source !== 'manual' && (
                      <span className="ml-1">
                        {e.source === 'voice' ? '🎙' : '📸'}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-bold text-sm text-status-danger whitespace-nowrap">
                  -{Number(e.amount).toLocaleString('ru')} ₽
                </span>
                <button
                  onClick={() => startEdit(e)}
                  className="text-tg-hint active:text-brand-500 p-1"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(e.id)}
                  className="text-status-danger active:text-status-danger p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="Удалить расход?"
        description="Расход будет удалён без возможности восстановления."
        confirmLabel="Удалить"
        variant="danger"
      />
    </div>
  );
}
