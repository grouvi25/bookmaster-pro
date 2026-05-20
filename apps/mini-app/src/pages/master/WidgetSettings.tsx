import { useState } from 'react';
import { HeaderBackButton } from "@/components/common/BackButton";
import { useQuery } from '@tanstack/react-query';
import { mastersApi } from '@/api/endpoints';
import { APP_URL } from '@/shared/config';
import PageHeader from '@/shared/ui/PageHeader';
import FeatureGate from '@/shared/ui/FeatureGate';
import { Copy, Check, Code, Globe } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

export default function WidgetSettings() {
  return (
    <FeatureGate flag="widget_enabled">
      <WidgetSettingsContent />
    </FeatureGate>
  );
}

function WidgetSettingsContent() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const resp = await mastersApi.getProfile();
      return resp.data;
    },
  });

  const slug = profile?.slug || '';
  const apiBase = import.meta.env.VITE_API_URL || '';

  const jsSnippet = `<script src="${apiBase}/api/v1/widget/js/${slug}"></script>`;
  const iframeSnippet = `<iframe src="${APP_URL}/embed/${slug}" style="width:100%;min-height:600px;border:none;border-radius:12px" allow="payment"></iframe>`;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast.success('Скопировано');
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="Виджет для сайта"
        left={<HeaderBackButton to="/master/settings" />}
      />

      <div className="px-screen-x space-y-4">
        <div className="bg-surface-elevated rounded-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-brand-500" />
            <div>
              <h3 className="font-semibold text-sm">Встройте запись на свой сайт</h3>
              <p className="text-xs text-tg-hint">Клиенты смогут записаться прямо с вашего сайта</p>
            </div>
          </div>
        </div>

        {!slug ? (
          <div className="bg-surface-elevated rounded-card p-4 text-center">
            <p className="text-sm text-tg-hint">
              Заполните профиль и получите slug для генерации виджета
            </p>
          </div>
        ) : (
          <>
            {/* JS Widget */}
            <div className="bg-surface-elevated rounded-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-brand-500" />
                <h3 className="font-semibold text-sm">JavaScript виджет</h3>
              </div>
              <p className="text-xs text-tg-hint">
                Вставьте этот код на свой сайт. Виджет автоматически подстроит размер.
              </p>
              <div className="bg-tg-bg rounded-xl p-3 font-mono text-xs break-all">
                {jsSnippet}
              </div>
              <button
                onClick={() => copyToClipboard(jsSnippet, 'js')}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium w-full justify-center"
              >
                {copiedField === 'js' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'js' ? 'Скопировано' : 'Копировать код'}
              </button>
            </div>

            {/* iframe */}
            <div className="bg-surface-elevated rounded-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-status-info" />
                <h3 className="font-semibold text-sm">iframe (альтернатива)</h3>
              </div>
              <p className="text-xs text-tg-hint">
                Если JS не подходит — используйте iframe.
              </p>
              <div className="bg-tg-bg rounded-xl p-3 font-mono text-xs break-all">
                {iframeSnippet}
              </div>
              <button
                onClick={() => copyToClipboard(iframeSnippet, 'iframe')}
                className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-tg-hint/20 text-tg-text rounded-xl text-sm font-medium w-full justify-center"
              >
                {copiedField === 'iframe' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedField === 'iframe' ? 'Скопировано' : 'Копировать код'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
