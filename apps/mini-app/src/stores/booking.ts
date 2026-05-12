import { create } from 'zustand';

interface BookingState {
  masterSlug: string;
  masterId: number | null;
  masterName: string;
  serviceId: number | null;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  selectedDate: string;
  selectedTime: string;
  promoCode: string;
  discount: number;
  loyaltyPoints: number;
  usePoints: boolean;
  setMaster: (slug: string, id: number, name: string) => void;
  setService: (id: number, name: string, price: number, duration: number) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setPromo: (code: string, discount: number) => void;
  setUsePoints: (use: boolean, points: number) => void;
  reset: () => void;
}

const initialState = {
  masterSlug: '',
  masterId: null as number | null,
  masterName: '',
  serviceId: null as number | null,
  serviceName: '',
  servicePrice: 0,
  serviceDuration: 0,
  selectedDate: '',
  selectedTime: '',
  promoCode: '',
  discount: 0,
  loyaltyPoints: 0,
  usePoints: false,
};

export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,
  setMaster: (slug, id, name) => set({ masterSlug: slug, masterId: id, masterName: name }),
  setService: (id, name, price, duration) =>
    set({ serviceId: id, serviceName: name, servicePrice: price, serviceDuration: duration }),
  setDate: (date) => set({ selectedDate: date }),
  setTime: (time) => set({ selectedTime: time }),
  setPromo: (code, discount) => set({ promoCode: code, discount }),
  setUsePoints: (use, points) => set({ usePoints: use, loyaltyPoints: points }),
  reset: () => set(initialState),
}));
