import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/api/endpoints';
import api from '@/api/client';
import PageHeader from '@/shared/ui/PageHeader';
import EmptyState from '@/shared/ui/EmptyState';
import Button from '@/shared/ui/Button';
import FeatureGate from '@/shared/ui/FeatureGate';
import { ArrowLeft, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/shared/ui/Toast';

interface SubscriptionPackage {
  id: number;
  service_id: number;
  service_name?: string;
  total_visits: number;
  price: number;
  discount_percent: number;
  is_active: boolean;
}

interface ServiceItem {
  id: number;
  name: string;
  price: number;
}

export default function SubscriptionPackages() {
  return (
    <FeatureGate flag="client_subscriptions">
      <SubscriptionPackagesContent />
    </FeatureGate>
  );
}

function SubscriptionPackagesContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    service_id: 0,
    total_visits: 5,
    price: 0,
  });

  const { data: services = [] } = useQuery<ServiceItem[]>({
    queryKey: ['my-services'],
    queryFn: async () => {
      const resp = await servicesApi.list();
      return resp.data;
    },
  });

  const { data: packages = [] } = useQuery<SubscriptionPackage[]>({
    queryKey: ['subscription-packages'],
    queryFn: async () => {
      const resp = await api.get('/payments/subscription-packages');
      return resp.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api.post('/payments/subscription-packages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-packages'] });
      toast.success('Пакет создан');
      setShowForm(false);
      setFormData({ service_id: 0, total_visits: 5, price: 0 });
    },
    onError: () => toast.error('Ошибка создания пакета'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/payments/subscription-packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-packages'] });
      toast.success('Пакет удалён');
    },
  });

  const selectedService = services.find((s) => s.id === formData.service_id);
  const singlePrice = selectedService?.price || 0;
  const discountPercent = singlePrice && formData.price
    ? Math.round((1 - formData.price / (singlePrice * formData.total_visits)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <PageHeader
        title="Абонементы"
        left={
          <button onClick={() => navigate('/master/settings')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
        right={
          <button onClick={() => setShowForm(!showForm)} className="p-2 text-brand-500">
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 space-y-4">
        {showForm && (
          <div className="bg-surface-elevated rounded-card p-4 space-y-3">
            <h3 className="font-semibold text-sm">Новый пакет</h3>

            <div>
              <label className="text-xs text-tg-hint mb-1 block">Услуга</label>
              <select
                value={formData.service_id}
                onChange={(e) => setFormData({ ...formData, service_id: Number(e.target.value) })}
                className="input-field"
              >
                <option value={0}>Выберите услугу</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.price} ₽</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-tg-hint mb-1 block">Количество визитов</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={formData.total_visits}
                  onChange={(e) => setFormData({ ...formData, total_visits: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-tg-hint mb-1 block">Цена пакета, ₽</label>
                <input
                  type="number"
                  min={0}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="input-field"
                  placeholder={String(singlePrice * formData.total_visits)}
                />
              </div>
            </div>

            {discountPercent > 0 && (
              <p className="text-xs text-green-600">Скидка: {discountPercent}% от стоимости разовых визитов</p>
            )}

            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.service_id || !formData.price || createMutation.isPending}
              className="w-full"
            >
              Создать пакет
            </Button>
          </div>
        )}

        {packages.length === 0 && !showForm ? (
          <EmptyState
            emoji="📦"
            title="Нет абонементов"
            description="Создайте пакет визитов для клиентов — они смогут купить их со скидкой"
            action={
              <Button onClick={() => setShowForm(true)} variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Создать пакет
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="bg-surface-elevated rounded-xl p-4 flex items-center gap-3">
                <Package className="w-5 h-5 text-brand-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{pkg.service_name || `Услуга #${pkg.service_id}`}</p>
                  <p className="text-xs text-tg-hint">
                    {pkg.total_visits} визитов · {Number(pkg.price).toLocaleString('ru')} ₽
                    {pkg.discount_percent > 0 && ` · -${pkg.discount_percent}%`}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(pkg.id)}
                  className="p-2 text-red-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
