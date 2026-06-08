
import { useState, useRef } from 'react';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { HeaderBackButton } from '@/components/common/BackButton';
import { importApi } from '@/api/endpoints';
import { Upload, FileSpreadsheet, Users, Scissors, Check, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

type ImportType = 'clients' | 'services';
type Step = 'upload' | 'preview' | 'result';

interface PreviewRow {
  row_num: number;
  data: Record<string, string>;
  status: string;
  message?: string;
}

interface PreviewData {
  file_name: string;
  import_type: string;
  platform_detected?: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  duplicate_rows: number;
  columns_found: string[];
  column_mapping: Record<string, string>;
  preview_rows: PreviewRow[];
  session_id: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: string[];
}

const PLATFORM_LABELS: Record<string, string> = {
  yclients: 'Yclients',
  dikidi: 'Dikidi',
  generic: 'CSV / Excel',
};

const CLIENT_FIELDS: Record<string, string> = {
  name: 'Имя',
  phone: 'Телефон',
  email: 'Email',
  birthday: 'Дата рождения',
  notes: 'Заметки',
  tags: 'Теги',
  source: 'Источник',
  discount: 'Скидка',
  city: 'Город',
  last_visit: 'Последний визит',
  visit_count: 'Кол-во визитов',
  total_spent: 'Сумма потрачено',
};

const SERVICE_FIELDS: Record<string, string> = {
  name: 'Название',
  description: 'Описание',
  duration_min: 'Длительность (мин)',
  price: 'Цена',
  price_max: 'Цена макс.',
  category: 'Категория',
};

export default function DataImport() {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = importType === 'clients' ? CLIENT_FIELDS : SERVICE_FIELDS;

  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await importApi.preview(formData, importType);
      setPreview(res.data);
      setMapping(res.data.column_mapping);
      setStep('preview');
    } catch {
      toast.error('Не удалось прочитать файл');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const res = await importApi.confirm({
        session_id: preview.session_id,
        column_mapping: mapping,
      });
      setResult(res.data);
      setStep('result');
    } catch {
      toast.error('Ошибка импорта');
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStep('upload');
    setPreview(null);
    setResult(null);
    setMapping({});
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateMapping = (srcCol: string, tgtField: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (tgtField === '') {
        delete next[srcCol];
      } else {
        // Remove existing mapping with same target
        for (const [k, v] of Object.entries(next)) {
          if (v === tgtField && k !== srcCol) delete next[k];
        }
        next[srcCol] = tgtField;
      }
      return next;
    });
  };

  return (
    <div className="px-screen-x pb-24">
      <HeaderBackButton />
      <PageHeader title="Импорт данных" />

      {/* Type selector */}
      {step === 'upload' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setImportType('clients')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors ${
                importType === 'clients'
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-hint'
              }`}
            >
              <Users className="w-4 h-4" /> Клиенты
            </button>
            <button
              onClick={() => setImportType('services')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors ${
                importType === 'services'
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-hint'
              }`}
            >
              <Scissors className="w-4 h-4" /> Услуги
            </button>
          </div>

          <Card>
            <div className="text-center py-6">
              <div className="text-3xl mb-2">📥</div>
              <p className="text-sm font-medium mb-1">
                {importType === 'clients' ? 'Импорт клиентов' : 'Импорт услуг'}
              </p>
              <p className="text-xs text-tg-hint mb-4">
                CSV или XLSX из Yclients, Dikidi или другой системы
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                loading={loading}
                fullWidth
              >
                <Upload className="w-4 h-4 mr-1" /> Выбрать файл
              </Button>
            </div>
          </Card>

          <Card className="mt-3">
            <p className="text-xs font-medium mb-2">💡 Поддерживаемые форматы:</p>
            <ul className="text-xs text-tg-hint space-y-1">
              <li>• Yclients — экспорт клиентов/услуг</li>
              <li>• Dikidi — экспорт базы</li>
              <li>• Любой CSV/XLSX с колонками</li>
              <li>• Автоопределение колонок</li>
              <li>• Дедупликация по телефону</li>
            </ul>
          </Card>
        </>
      )}

      {/* Preview step */}
      {step === 'preview' && preview && (
        <>
          <Card className="mb-3">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="w-5 h-5 text-tg-link" />
              <div className="flex-1">
                <p className="text-sm font-medium">{preview.file_name}</p>
                <p className="text-xs text-tg-hint">
                  {preview.platform_detected && PLATFORM_LABELS[preview.platform_detected]
                    ? `Формат: ${PLATFORM_LABELS[preview.platform_detected]} · ` : ''}
                  {preview.total_rows} строк
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-status-success/10 rounded-lg p-2">
                <div className="text-lg font-bold text-status-success">{preview.valid_rows}</div>
                <div className="text-[10px] text-tg-hint">Готово</div>
              </div>
              <div className="bg-status-warning/10 rounded-lg p-2">
                <div className="text-lg font-bold text-status-warning">{preview.duplicate_rows}</div>
                <div className="text-[10px] text-tg-hint">Дубли</div>
              </div>
              <div className="bg-status-danger/10 rounded-lg p-2">
                <div className="text-lg font-bold text-status-danger">{preview.error_rows}</div>
                <div className="text-[10px] text-tg-hint">Ошибки</div>
              </div>
            </div>
          </Card>

          {/* Column mapping */}
          <Card className="mb-3">
            <p className="text-xs font-medium mb-2">📋 Маппинг колонок:</p>
            <div className="space-y-2">
              {preview.columns_found.map(col => (
                <div key={col} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate">{col}</span>
                  <ArrowRight className="w-3 h-3 text-tg-hint flex-shrink-0" />
                  <select
                    value={mapping[col] || ''}
                    onChange={e => updateMapping(col, e.target.value)}
                    className="input-field text-xs py-1 max-w-[140px]"
                  >
                    <option value="">— пропустить —</option>
                    {Object.entries(fields).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview rows */}
          <Card className="mb-3">
            <p className="text-xs font-medium mb-2">👀 Превью (первые {preview.preview_rows.length} строк):</p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {preview.preview_rows.slice(0, 10).map(row => (
                <div
                  key={row.row_num}
                  className={`flex items-start gap-2 text-xs p-2 rounded ${
                    row.status === 'error' ? 'bg-status-danger/10' :
                    row.status === 'warning' ? 'bg-status-warning/10' :
                    'bg-tg-secondary/50'
                  }`}
                >
                  <span className="text-tg-hint w-5 flex-shrink-0">#{row.row_num}</span>
                  <div className="flex-1 min-w-0">
                    {Object.entries(row.data).filter(([_, v]) => v).map(([k, v]) => (
                      <span key={k} className="inline-block mr-2">
                        <span className="text-tg-hint">{fields[k] || k}: </span>
                        <span>{String(v)}</span>
                      </span>
                    ))}
                  </div>
                  {row.status === 'error' && <XCircle className="w-3 h-3 text-status-danger flex-shrink-0" />}
                  {row.status === 'warning' && <AlertTriangle className="w-3 h-3 text-status-warning flex-shrink-0" />}
                  {row.status === 'ok' && <Check className="w-3 h-3 text-status-success flex-shrink-0" />}
                </div>
              ))}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} fullWidth>
              Отмена
            </Button>
            <Button onClick={handleConfirm} loading={loading} fullWidth>
              <Check className="w-4 h-4 mr-1" />
              Импортировать {preview.valid_rows}
            </Button>
          </div>
        </>
      )}

      {/* Result step */}
      {step === 'result' && result && (
        <>
          <Card className="mb-3 text-center py-6">
            <div className="text-4xl mb-2">
              {result.errors === 0 && result.imported > 0 ? '🎉' : result.imported > 0 ? '⚠️' : '❌'}
            </div>
            <p className="text-sm font-medium mb-4">
              {result.imported > 0 ? 'Импорт завершён!' : 'Ничего не импортировано'}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-status-success">{result.imported}</div>
                <div className="text-[10px] text-tg-hint">Добавлено</div>
              </div>
              <div>
                <div className="text-xl font-bold text-status-warning">{result.skipped}</div>
                <div className="text-[10px] text-tg-hint">Пропущено</div>
              </div>
              <div>
                <div className="text-xl font-bold text-status-danger">{result.errors}</div>
                <div className="text-[10px] text-tg-hint">Ошибки</div>
              </div>
            </div>
          </Card>

          {result.details.length > 0 && (
            <Card className="mb-3">
              <p className="text-xs font-medium mb-2">📝 Детали:</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {result.details.map((d, i) => (
                  <p key={i} className="text-xs text-tg-hint">{d}</p>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={reset} fullWidth>
            Импортировать ещё
          </Button>
        </>
      )}
    </div>
  );
}
