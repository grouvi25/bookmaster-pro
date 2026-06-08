import { useState } from 'react';
import { HeaderBackButton } from "@/components/common/BackButton";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationsApi } from '@/api/endpoints';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import PageHeader from '@/shared/ui/PageHeader';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';
import EmptyState from '@/shared/ui/EmptyState';
import { MapPin, Plus, Trash2, Check } from 'lucide-react';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';

export default function Locations() {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => locationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  if (isLoading) return <div className="px-screen-x py-section-y"><ListSkeleton count={3} /></div>;

  const locations = (data || []) as Array<{
    id: number;
    name: string;
    address: string | null;
    is_default: boolean;
    is_active: boolean;
  }>;

  return (
    <div >
      <PageHeader
        title="Локации"
        left={<HeaderBackButton to="/master/settings" />}
        right={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 bg-tg-button text-tg-button-text px-3 py-2 rounded-btn text-sm font-medium interactive"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        }
      />

      <div className="px-screen-x">

      {showCreate && <CreateLocation onClose={() => setShowCreate(false)} />}

      <div className="flex flex-col gap-3">
        {locations.length === 0 ? (
          <EmptyState emoji="📍" title="Нет локаций" description="Добавьте первую локацию" />
        ) : (
          locations.map((loc) => (
            <Card key={loc.id} className="flex justify-between items-center">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-tg-link mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {loc.name}
                    {loc.is_default && (
                      <span className="text-xs bg-tg-button/10 text-tg-button px-1.5 py-0.5 rounded">
                        По умолчанию
                      </span>
                    )}
                  </div>
                  {loc.address && (
                    <p className="text-xs text-tg-hint mt-0.5">{loc.address}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeleteConfirmId(loc.id)}
                className="text-status-danger p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))
        )}
      </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}
        title="Удалить локацию?"
        description={deleteConfirmId ? `«${locations.find((l) => l.id === deleteConfirmId)?.name ?? ''}» — будет удалена.` : undefined}
        confirmLabel="Удалить"
        variant="danger"
      />
    </div>
  );
}

function CreateLocation({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      locationsApi.create({ name, address, is_default: isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onClose();
    },
  });

  return (
    <Card className="mb-5">
      <h3 className="text-sm font-semibold mb-3">Новая локация</h3>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название"
        className="input-field mb-2"
      />

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Адрес"
        className="input-field mb-3"
      />

      <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
        <button
          onClick={() => setIsDefault(!isDefault)}
          className={`w-5 h-5 rounded border flex items-center justify-center ${
            isDefault ? 'bg-tg-button border-tg-button' : 'border-tg-hint'
          }`}
        >
          {isDefault && <Check className="w-3.5 h-3.5 text-tg-button-text" />}
        </button>
        По умолчанию
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => createMutation.mutate()}
          disabled={!name || createMutation.isPending}
        >
          Создать
        </Button>
      </div>
    </Card>
  );
}
