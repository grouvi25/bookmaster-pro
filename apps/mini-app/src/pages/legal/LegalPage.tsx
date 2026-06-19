/**
 * Публичная страница юридических документов.
 *
 * Роуты:
 *  /legal/terms   — условия оказания услуг
 *  /legal/payment — условия оплаты и возврата
 *
 * Текст загружается из API (SystemSetting) — редактируется
 * через суперадмин-панель без редеплоя.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { legalApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { ArrowLeft } from 'lucide-react';

interface LegalDocument {
  doc_type: string;
  title: string;
  content: string;
  legal_entity_name: string;
  legal_entity_inn: string;
}

export default function LegalPage() {
  const { docType } = useParams<{ docType: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery<LegalDocument>({
    queryKey: ['legal-document', docType],
    queryFn: () => legalApi.getDocument(docType!).then((r) => r.data),
    enabled: !!docType,
  });

  if (isLoading) {
    return (
      <div className="px-screen-x pt-4">
        <ListSkeleton count={3} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-screen-x pt-4">
        <Card>
          <p className="text-center text-tg-hint text-sm py-8">
            Документ не найден
          </p>
        </Card>
      </div>
    );
  }

  const hasEntity = data.legal_entity_name || data.legal_entity_inn;

  return (
    <div>
      <PageHeader
        title={data.title}
        left={
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-screen-x flex flex-col gap-3 pb-8">
        {/* Основной текст документа */}
        {data.content ? (
          <Card>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-tg-text">
              {data.content}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-center text-tg-hint text-sm py-8">
              Документ ещё не заполнен
            </p>
          </Card>
        )}

        {/* Реквизиты юр. лица */}
        {hasEntity && (
          <Card>
            <h3 className="text-sm font-semibold mb-2">Реквизиты</h3>
            <div className="flex flex-col gap-1 text-sm">
              {data.legal_entity_name && (
                <div className="flex justify-between">
                  <span className="text-tg-hint">Юр. лицо</span>
                  <span className="text-right">{data.legal_entity_name}</span>
                </div>
              )}
              {data.legal_entity_inn && (
                <div className="flex justify-between">
                  <span className="text-tg-hint">ИНН / ОГРНИП</span>
                  <span>{data.legal_entity_inn}</span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
