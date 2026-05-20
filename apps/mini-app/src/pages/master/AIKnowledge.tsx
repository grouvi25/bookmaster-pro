import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { aiApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import PageHeader from '@/shared/ui/PageHeader';
import EmptyState from '@/shared/ui/EmptyState';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import FeatureGate from '@/shared/ui/FeatureGate';
import { FileText, Plus, Trash2, Loader2 } from 'lucide-react';

interface KnowledgeDoc {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  pages_count: number | null;
  chars_count: number | null;
  chunks_count: number;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  error: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = ['pdf', 'txt', 'md', 'markdown'];

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: KnowledgeDoc['status'] }) {
  if (status === 'indexed') {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-success/10 text-status-success">
        Готов
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger">
        Ошибка
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-warning/10 text-status-warning">
      Обработка
    </span>
  );
}

export default function AIKnowledge() {
  return (
    <FeatureGate flag="ai_advisor">
      <AIKnowledgeInner />
    </FeatureGate>
  );
}

function AIKnowledgeInner() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<KnowledgeDoc | null>(null);

  const { data, isLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ['ai-knowledge-docs'],
    queryFn: () => aiApi.knowledge.list().then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => aiApi.knowledge.upload(file),
    onSuccess: (resp) => {
      const doc = resp.data?.document;
      const chunks = resp.data?.chunks_created ?? 0;
      toast.success(
        doc
          ? `«${doc.filename}» загружен (${chunks} фрагментов)`
          : 'Документ загружен'
      );
      queryClient.invalidateQueries({ queryKey: ['ai-knowledge-docs'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err.response?.data?.detail || 'Ошибка загрузки');
    },
    onSettled: () => {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => aiApi.knowledge.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-knowledge-docs'] });
      toast.success('Документ удалён');
      setDocToDelete(null);
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const handlePick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXT.includes(ext)) {
      toast.error('Только PDF и TXT (до 10 МБ)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Файл больше 10 МБ');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    uploadMutation.mutate(file);
  };

  const handleDelete = (doc: KnowledgeDoc) => {
    setDocToDelete(doc);
  };

  const docs = data || [];

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="База знаний AI"
        left={<HeaderBackButton to="/master/ai" />}
        right={
          <Button
            variant="primary"
            size="sm"
            onClick={handlePick}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загрузка...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> Документ
              </>
            )}
          </Button>
        }
      />

      <div className="px-screen-x">
      <p className="text-xs text-tg-hint mb-4">
        Загрузите PDF или TXT с информацией о вашем бизнесе — AI-советник будет
        использовать их при ответах. До 10 МБ на файл.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        onChange={handleFileChange}
        className="hidden"
      />

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : docs.length === 0 ? (
        <Card className="!py-10">
          <EmptyState
            emoji="📚"
            title="Пока ничего не загружено"
            description="Добавьте PDF или TXT — например прайс с описаниями, правила работы, FAQ — и AI начнёт ссылаться на них."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {docs.map((doc) => (
            <Card key={doc.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="font-medium text-sm truncate flex-1">
                      {doc.filename}
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="text-[11px] text-tg-hint">
                    {formatSize(doc.size_bytes)}
                    {doc.pages_count ? ` · ${doc.pages_count} стр.` : ''}
                    {doc.chunks_count
                      ? ` · ${doc.chunks_count} фрагментов`
                      : ''}
                  </div>
                  <div className="text-[11px] text-tg-hint mt-0.5">
                    {formatDate(doc.created_at)}
                  </div>
                  {doc.status === 'error' && doc.error && (
                    <div className="text-[11px] text-status-danger mt-1 line-clamp-2">
                      {doc.error}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deleteMutation.isPending}
                  aria-label="Удалить"
                  className="text-tg-hint hover:text-status-danger transition-colors p-1.5 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>

      <ConfirmDialog
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => docToDelete && deleteMutation.mutate(docToDelete.id)}
        title="Удалить документ?"
        description={
          docToDelete
            ? `«${docToDelete.filename}» — AI больше не будет учитывать этот документ.`
            : undefined
        }
        confirmLabel="Удалить"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
