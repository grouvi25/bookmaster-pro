import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationsApi } from '@/api/endpoints';
import Loading from '@/components/common/Loading';
import { MapPin, Plus, Trash2, Check } from 'lucide-react';

export default function Locations() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => locationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  if (isLoading) return <Loading />;

  const locations = (data || []) as Array<{
    id: number;
    name: string;
    address: string | null;
    is_default: boolean;
    is_active: boolean;
  }>;

  return (
    <div className="p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Локации</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-tg-button text-tg-button-text px-3 py-2 rounded-xl text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {showCreate && <CreateLocation onClose={() => setShowCreate(false)} />}

      <div className="flex flex-col gap-3">
        {locations.length === 0 ? (
          <p className="text-tg-hint text-center py-8">Нет локаций</p>
        ) : (
          locations.map((loc) => (
            <div key={loc.id} className="bg-surface-elevated rounded-card p-4 flex justify-between items-center">
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
                onClick={() => deleteMutation.mutate(loc.id)}
                className="text-red-400 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
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
    <div className="bg-surface-elevated rounded-card p-4 mb-5">
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
        className="w-full px-3 py-2 bg-tg-bg rounded-lg text-sm outline-none mb-3"
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
        <button onClick={onClose} className="text-xs text-tg-hint">
          Отмена
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!name || createMutation.isPending}
          className="bg-tg-button text-tg-button-text px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          Создать
        </button>
      </div>
    </div>
  );
}
