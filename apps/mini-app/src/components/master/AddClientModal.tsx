import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '@/api/endpoints';
import BottomSheet from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddClientModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setName('');
    setPhone('');
    setBirthday('');
    setNotes('');
  };

  const createMutation = useMutation({
    mutationFn: () =>
      clientsApi.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
        birthday: birthday || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Клиент добавлен');
      reset();
      onClose();
    },
    onError: () => toast.error('Не удалось добавить клиента'),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Введите имя клиента');
      return;
    }
    createMutation.mutate();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Новый клиент">
      <div className="px-screen-x pb-6 pt-2 flex flex-col gap-4">
        <div>
          <label className="text-aux text-tg-hint mb-1.5 block">Имя *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Анна Иванова"
            autoFocus
            className="w-full h-[52px] px-4 rounded-card bg-tg-secondary text-tg-text placeholder:text-tg-hint outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>

        <div>
          <label className="text-aux text-tg-hint mb-1.5 block">Телефон</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            className="w-full h-[52px] px-4 rounded-card bg-tg-secondary text-tg-text placeholder:text-tg-hint outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>

        <div>
          <label className="text-aux text-tg-hint mb-1.5 block">День рождения</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full h-[52px] px-4 rounded-card bg-tg-secondary text-tg-text placeholder:text-tg-hint outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>

        <div>
          <label className="text-aux text-tg-hint mb-1.5 block">Заметка</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Предпочтения, особенности и т.д."
            rows={3}
            className="w-full px-4 py-3 rounded-card bg-tg-secondary text-tg-text placeholder:text-tg-hint outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
          />
        </div>

        <Button
          fullWidth
          onClick={handleSubmit}
          loading={createMutation.isPending}
          className="mt-2"
        >
          Добавить клиента
        </Button>
      </div>
    </BottomSheet>
  );
}
