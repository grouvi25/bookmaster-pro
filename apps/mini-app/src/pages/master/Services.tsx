import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '@/api/endpoints';
import { toArray } from '@/shared/lib/normalize';
import Loading from '@/components/common/Loading';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { Plus, GripVertical, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ServiceItem {
  id: number;
  name: string;
  price: number;
  price_max: number | null;
  duration_min: number;
  description: string | null;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

function SortableServiceCard({
  svc,
  onEdit,
  onDelete,
}: {
  svc: ServiceItem;
  onEdit: (s: ServiceItem) => void;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: svc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="touch-none text-tg-hint cursor-grab active:cursor-grabbing p-1"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{svc.name}</div>
          <div className="text-xs text-tg-hint">
            {svc.duration_min} мин
            {svc.category && ` · ${svc.category}`}
          </div>
        </div>
        <span className="font-bold text-sm text-brand-600 whitespace-nowrap">
          {svc.price
            ? svc.price_max
              ? `${Number(svc.price).toLocaleString('ru')}–${Number(svc.price_max).toLocaleString('ru')} ₽`
              : `${Number(svc.price).toLocaleString('ru')} ₽`
            : 'Дог.'}
        </span>
        <button
          onClick={() => onEdit(svc)}
          className="text-tg-hint active:text-brand-500 p-1"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(svc.id)}
          className="text-red-400 active:text-red-600 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </Card>
    </div>
  );
}

export default function Services() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formPriceMax, setFormPriceMax] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [localOrder, setLocalOrder] = useState<ServiceItem[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const services: ServiceItem[] = localOrder ?? toArray<ServiceItem>(data);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = services.findIndex((s) => s.id === active.id);
      const newIndex = services.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(services, oldIndex, newIndex);
      setLocalOrder(newOrder);

      try {
        await servicesApi.reorder(newOrder.map((s) => s.id));
        await queryClient.invalidateQueries({ queryKey: ['my-services'] });
        setLocalOrder(null);
      } catch {
        toast.error('Ошибка сортировки');
        setLocalOrder(null);
      }
    },
    [services, queryClient]
  );

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormPriceMax('');
    setFormDuration('60');
    setFormCategory('');
    setFormDescription('');
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (svc: ServiceItem) => {
    setEditingId(svc.id);
    setFormName(svc.name);
    setFormPrice(svc.price ? String(svc.price) : '');
    setFormPriceMax(svc.price_max ? String(svc.price_max) : '');
    setFormDuration(String(svc.duration_min));
    setFormCategory(svc.category ?? '');
    setFormDescription(svc.description ?? '');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Введите название');
      return;
    }
    setFormLoading(true);
    try {
      const payload: {
        name: string;
        price: number;
        duration_min: number;
        price_max?: number;
        category?: string;
        description?: string;
      } = {
        name: formName.trim(),
        price: formPrice ? Number(formPrice) : 0,
        duration_min: Number(formDuration) || 60,
      };
      if (formPriceMax) payload.price_max = Number(formPriceMax);
      if (formCategory.trim()) payload.category = formCategory.trim();
      if (formDescription.trim()) payload.description = formDescription.trim();

      if (editingId) {
        await servicesApi.update(editingId, payload);
        toast.success('Услуга обновлена');
      } else {
        await servicesApi.create(payload);
        toast.success('Услуга добавлена');
      }
      await queryClient.invalidateQueries({ queryKey: ['my-services'] });
      resetForm();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await servicesApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['my-services'] });
      toast.success('Услуга удалена');
    } catch {
      toast.error('Ошибка при удалении');
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="p-4 pb-20 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Мои услуги</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-1 text-tg-link text-sm"
        >
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      {showForm && (
        <Card className="mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-sm">
              {editingId ? 'Редактирование' : 'Новая услуга'}
            </span>
            <button onClick={resetForm} className="text-tg-hint p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Название услуги"
              className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg"
            />
            <div className="flex gap-2">
              <input
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="Цена, ₽"
                type="number"
                className="flex-1 p-3 rounded-xl text-sm outline-none bg-tg-bg"
              />
              <input
                value={formPriceMax}
                onChange={(e) => setFormPriceMax(e.target.value)}
                placeholder="До, ₽"
                type="number"
                className="flex-1 p-3 rounded-xl text-sm outline-none bg-tg-bg"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                placeholder="Мин"
                type="number"
                className="w-24 p-3 rounded-xl text-sm outline-none bg-tg-bg"
              />
              <input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="Категория"
                className="flex-1 p-3 rounded-xl text-sm outline-none bg-tg-bg"
              />
            </div>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              rows={2}
              className="w-full p-3 rounded-xl text-sm outline-none bg-tg-bg resize-none"
            />
            <Button onClick={handleSubmit} loading={formLoading} fullWidth size="sm">
              <Check className="w-4 h-4 mr-1" />
              {editingId ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </Card>
      )}

      {services.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-tg-hint mb-2">Нет услуг</p>
          <p className="text-tg-hint text-xs">Добавьте первую услугу</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={services.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {services.map((svc) => (
                <SortableServiceCard
                  key={svc.id}
                  svc={svc}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <p className="text-xs text-tg-hint text-center mt-4">
        Перетаскивайте услуги для изменения порядка
      </p>
    </div>
  );
}
