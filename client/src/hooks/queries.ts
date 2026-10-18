import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Analytics,
  Appointment,
  AppointmentDetail,
  AssistantReply,
  AvailabilityDay,
  AvailabilityResult,
  Category,
  Customer,
  CustomerDetail,
  Dashboard,
  NotificationItem,
  Paged,
  Service,
  SearchResults,
  SessionInfo,
  Staff,
  StaffDetail,
  StudioSettings,
  TimeOff,
} from '@/types';

type Params = Record<string, string | number | boolean | undefined | null>;

/* --------------------------------- queries --------------------------------- */
export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/dashboard'), refetchInterval: 60_000 });

export const useAppointments = (params: Params, enabled = true) =>
  useQuery({
    queryKey: ['appointments', params],
    queryFn: () => api.get<Paged<Appointment>>('/appointments', params),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useAppointment = (id: string | undefined) =>
  useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.get<AppointmentDetail>(`/appointments/${id}`),
    enabled: !!id,
  });

export const useAvailability = (params: { staffId?: string; serviceId?: string; date?: string; excludeId?: string }) =>
  useQuery({
    queryKey: ['availability', params],
    queryFn: () => api.get<AvailabilityResult>('/appointments/availability', params),
    enabled: !!params.staffId && !!params.serviceId && !!params.date,
  });

export const useCustomers = (params: Params, enabled = true) =>
  useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get<Paged<Customer>>('/customers', params),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useCustomer = (id: string | undefined) =>
  useQuery({ queryKey: ['customer', id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`), enabled: !!id });

export const useServices = (params: Params = {}) =>
  useQuery({ queryKey: ['services', params], queryFn: () => api.get<{ data: Service[] }>('/services', params) });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ data: Category[] }>('/services/categories') });

export const useStaffList = (params: Params = {}) =>
  useQuery({ queryKey: ['staff', params], queryFn: () => api.get<{ data: Staff[] }>('/staff', params) });

export const useStaffMember = (id: string | undefined) =>
  useQuery({ queryKey: ['staff-member', id], queryFn: () => api.get<StaffDetail>(`/staff/${id}`), enabled: !!id });

export const useAnalytics = (range: number) =>
  useQuery({
    queryKey: ['analytics', range],
    queryFn: () => api.get<Analytics>('/analytics', { range }),
    placeholderData: keepPreviousData,
  });

export const useNotifications = (limit = 50) =>
  useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => api.get<{ data: NotificationItem[]; unreadCount: number }>('/notifications', { limit }),
    refetchInterval: 45_000,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResults>('/search', { q }),
    enabled: q.trim().length > 0,
    staleTime: 15_000,
  });

export const useStudio = () =>
  useQuery({ queryKey: ['studio'], queryFn: () => api.get<{ studio: StudioSettings }>('/settings/studio') });

export const useSessionInfo = () =>
  useQuery({ queryKey: ['session-info'], queryFn: () => api.get<{ session: SessionInfo }>('/auth/session') });

export const useAssistantSuggestions = () =>
  useQuery({
    queryKey: ['assistant-suggestions'],
    queryFn: () => api.get<{ suggestions: string[] }>('/assistant/suggestions'),
    staleTime: Infinity,
  });

/* -------------------------------- mutations -------------------------------- */
/** Runs a mutation, then refreshes every cached list so screens never show stale data. */
export function useAction<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export const useSaveCustomer = () =>
  useAction(({ id, values }: { id?: string; values: Record<string, unknown> }) =>
    id
      ? api.put<{ customer: Customer }>(`/customers/${id}`, values)
      : api.post<{ customer: Customer }>('/customers', values),
  );
export const useDeleteCustomer = () => useAction((id: string) => api.delete(`/customers/${id}`));
export const useAddNote = () =>
  useAction(({ customerId, body }: { customerId: string; body: string }) =>
    api.post(`/customers/${customerId}/notes`, { body }),
  );
export const useDeleteNote = () =>
  useAction(({ customerId, noteId }: { customerId: string; noteId: string }) =>
    api.delete(`/customers/${customerId}/notes/${noteId}`),
  );

export const useSaveService = () =>
  useAction(({ id, values }: { id?: string; values: Record<string, unknown> }) =>
    id ? api.put<{ service: Service }>(`/services/${id}`, values) : api.post<{ service: Service }>('/services', values),
  );
export const useToggleService = () =>
  useAction(({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/services/${id}/active`, { isActive }));
export const useDeleteService = () => useAction((id: string) => api.delete(`/services/${id}`));

export const useSaveStaff = () =>
  useAction(({ id, values }: { id?: string; values: Record<string, unknown> }) =>
    id ? api.put<{ staff: Staff }>(`/staff/${id}`, values) : api.post<{ staff: Staff }>('/staff', values),
  );
export const useSaveAvailability = () =>
  useAction(({ id, days }: { id: string; days: AvailabilityDay[] }) => api.put(`/staff/${id}/availability`, { days }));
export const useAddTimeOff = () =>
  useAction(({ id, values }: { id: string; values: Record<string, unknown> }) =>
    api.post<{ timeOff: TimeOff }>(`/staff/${id}/time-off`, values),
  );
export const useRemoveTimeOff = () =>
  useAction(({ id, timeOffId }: { id: string; timeOffId: string }) => api.delete(`/staff/${id}/time-off/${timeOffId}`));

export const useCreateAppointment = () =>
  useAction((values: Record<string, unknown>) => api.post<{ appointment: Appointment }>('/appointments', values));
export const useUpdateAppointment = () =>
  useAction(({ id, values }: { id: string; values: Record<string, unknown> }) =>
    api.put<{ appointment: Appointment }>(`/appointments/${id}`, values),
  );
export const useDeleteAppointment = () => useAction((id: string) => api.delete(`/appointments/${id}`));
export const useSetPayment = () =>
  useAction(({ id, values }: { id: string; values: Record<string, unknown> }) =>
    api.put<AppointmentDetail>(`/appointments/${id}/payment`, values),
  );

export const useMarkNotificationRead = () => useAction((id: string) => api.put(`/notifications/${id}/read`));
export const useMarkAllNotificationsRead = () => useAction(() => api.put('/notifications/read-all'));

export const useAskAssistant = () => useMutation({ mutationFn: (message: string) => api.post<AssistantReply>('/assistant', { message }) });
