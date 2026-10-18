import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Appointment, Customer, Service, Staff } from '@/types';
import { AppointmentEditModal } from './AppointmentEditModal';
import { AppointmentQuickView } from './AppointmentQuickView';
import { BookingModal } from './BookingModal';
import { CustomerFormModal } from './CustomerFormModal';
import { ModalsContext, type BookingInitial, type ModalsApi } from './ModalsContext';
import { ServiceFormModal } from './ServiceFormModal';
import { StaffFormModal } from './StaffFormModal';

interface Opened<T> {
  key: number;
  value: T;
}

/** Owns every app-wide dialog so any page can open them (Add customer, Book, Appointment details...). */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<Opened<BookingInitial | undefined> | null>(null);
  const [customer, setCustomer] = useState<Opened<{ customer: Customer | null; onSaved?: (c: Customer) => void }> | null>(null);
  const [service, setService] = useState<Opened<Service | null> | null>(null);
  const [staff, setStaff] = useState<Opened<Staff | null> | null>(null);
  const [quickView, setQuickView] = useState<string | null>(null);
  const [edit, setEdit] = useState<Appointment | null>(null);

  const api = useMemo<ModalsApi>(
    () => ({
      openBooking: (initial) => setBooking({ key: Date.now(), value: initial }),
      openCustomer: (c, onSaved) => setCustomer({ key: Date.now(), value: { customer: c ?? null, onSaved } }),
      openService: (s) => setService({ key: Date.now(), value: s ?? null }),
      openStaff: (s) => setStaff({ key: Date.now(), value: s ?? null }),
      openAppointment: (id) => setQuickView(id),
      editAppointment: (a) => setEdit(a),
    }),
    [],
  );

  const closeBooking = useCallback(() => setBooking(null), []);
  const closeCustomer = useCallback(() => setCustomer(null), []);
  const closeService = useCallback(() => setService(null), []);
  const closeStaff = useCallback(() => setStaff(null), []);
  const closeQuickView = useCallback(() => setQuickView(null), []);
  const closeEdit = useCallback(() => setEdit(null), []);

  return (
    <ModalsContext.Provider value={api}>
      {children}
      {booking && <BookingModal key={booking.key} open initial={booking.value} onClose={closeBooking} />}
      {customer && (
        <CustomerFormModal
          key={customer.key}
          open
          customer={customer.value.customer}
          onSaved={customer.value.onSaved}
          onClose={closeCustomer}
        />
      )}
      {service && <ServiceFormModal key={service.key} open service={service.value} onClose={closeService} />}
      {staff && <StaffFormModal key={staff.key} open staff={staff.value} onClose={closeStaff} />}
      {quickView && <AppointmentQuickView key={quickView} open appointmentId={quickView} onClose={closeQuickView} />}
      {edit && <AppointmentEditModal key={edit.id} open appointment={edit} onClose={closeEdit} />}
    </ModalsContext.Provider>
  );
}
