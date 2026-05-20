import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { HeaderBackButton } from "@/components/common/BackButton";
import { aiApi } from '@/api/endpoints';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import PageHeader from '@/shared/ui/PageHeader';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/Toast';
import { Sparkles, Copy, Check } from 'lucide-react';

interface Template {
  key: string;
  name: string;
  required_params: string[];
}

export default function AIContentTools() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['ai-templates'],
    queryFn: () => aiApi.templates().then((r) => r.data),
  });

  const { data: tokensInfo } = useQuery({
    queryKey: ['ai-tokens'],
    queryFn: () => aiApi.tokens().then((r) => r.data),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      aiApi.generateContent({
        template_key: selectedTemplate!.key,
        params,
      }),
    onSuccess: (resp) => {
      setResult(resp.data.content || resp.data.text || JSON.stringify(resp.data));
    },
    onError: () => toast.error('Ошибка генерации'),
  });

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success('Скопировано!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <ListSkeleton count={4} />;

  const templateList = templates || [];

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="AI контент-мастер"
        left={<HeaderBackButton />}
      />

      <div className="px-screen-x">
      {tokensInfo && (
        <p className="text-xs text-tg-hint mb-4">
          Токены: {tokensInfo.used?.toLocaleString('ru') ?? 0} / {tokensInfo.limit?.toLocaleString('ru') ?? '∞'}
        </p>
      )}

      {!selectedTemplate ? (
        <div className="flex flex-col gap-2.5">
          {templateList.map((tmpl) => (
            <Card
              key={tmpl.key}
              onClick={() => {
                setSelectedTemplate(tmpl);
                setResult(null);
                setParams({});
              }}
              className="cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{tmpl.name}</div>
                  {tmpl.required_params.length > 0 && (
                    <div className="text-xs text-tg-hint">
                      Параметры: {tmpl.required_params.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {templateList.length === 0 && (
            <Card className="!py-8 text-center text-sm text-tg-hint">
              Шаблоны не найдены
            </Card>
          )}
        </div>
      ) : (
        <div className="animate-slide-up">
          <Card className="mb-4">
            <h3 className="font-semibold text-sm mb-3">{selectedTemplate.name}</h3>

            {selectedTemplate.required_params.map((param) => (
              <div key={param} className="mb-2">
                <label className="text-xs text-tg-hint mb-1 block capitalize">{param}</label>
                <input
                  value={params[param] || ''}
                  onChange={(e) => setParams((prev) => ({ ...prev, [param]: e.target.value }))}
                  className="input-field"
                  placeholder={param}
                />
              </div>
            ))}

            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedTemplate(null)}>
                Назад
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {generateMutation.isPending ? 'Генерирую...' : 'Сгенерировать'}
              </Button>
            </div>
          </Card>

          {result && (
            <Card className="relative">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{result}</div>
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 text-tg-hint hover:text-tg-text transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </Card>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
