import { createContext, useContext } from 'react';
import type { Appointment, Customer, Service, Staff } from '@/types';

export interface BookingInitial {
  date?: string;
  startTime?: string;
  customerId?: string;
  staffId?: string;
  serviceId?: string;
}

export interface ModalsApi {
  openBooking: (initial?: BookingInitial) => void;
  openCustomer: (customer?: Customer | null, onSaved?: (customer: Customer) => void) => void;
  openService: (service?: Service | null) => void;
  openStaff: (staff?: Staff | null) => void;
  openAppointment: (id: string) => void;
  editAppointment: (appointment: Appointment) => void;
}

export const ModalsContext = createContext<ModalsApi | null>(null);

export function useModals(): ModalsApi {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used inside ModalProvider');
  return ctx;
}
