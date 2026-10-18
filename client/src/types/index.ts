export type Role = 'admin' | 'staff';

export interface NotificationPrefs {
  appointment_reminders: boolean;
  email_notifications: boolean;
  booking_notifications: boolean;
  cancellation_notifications: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  avatarUrl: string | null;
  studioId: string;
  studioName: string;
  timezone: string;
  currency: string;
  staffId: string | null;
  notificationPrefs: NotificationPrefs;
}

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'telebirr', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  price: number;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: string;
  amountPaid: number;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  preferredService: string;
  preferredStaff: string;
  schedulingPreference: string;
  appointmentCount: number;
  lastVisit: string | null;
  totalSpent: number;
}

export interface CustomerAppointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  price: number;
  serviceName: string;
  staffName: string;
  staffColor: string;
}

export interface CustomerNote {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
}

export interface ActivityEntry {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: Customer & {
    nextAppointment: { id: string; date: string; startTime: string; serviceName: string; staffName: string } | null;
  };
  appointments: CustomerAppointment[];
  notes: CustomerNote[];
  activity: ActivityEntry[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  categoryId: string;
  category: string;
  bookingCount: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface AvailabilityDay {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleTitle: string;
  specialties: string[];
  status: 'active' | 'inactive';
  avatarUrl: string | null;
  avatarColor: string;
  hasLogin: boolean;
  createdAt: string;
  availability: AvailabilityDay[];
}

export interface TimeOff {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface StaffDetail {
  staff: Staff;
  timeOff: TimeOff[];
  stats: { total: number; completed: number; upcoming: number };
  upcoming: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    customerName: string;
    serviceName: string;
  }[];
}

export interface Slot {
  start: string;
  end: string;
}

export interface AvailabilityResult {
  slots: Slot[];
  reason?: string;
  workStart?: string;
  workEnd?: string;
}

export interface AppointmentDetail {
  appointment: Appointment;
  payment: { id: string; amount: number; method: PaymentMethod; status: PaymentStatus; paidAt: string } | null;
  history: { id: string; action: string; description: string; createdAt: string; userName: string | null }[];
}

export interface PaymentRow {
  id: string;
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  customerName: string;
  serviceName: string;
}

export interface NotificationItem {
  id: string;
  type: 'booking' | 'confirmation' | 'cancellation' | 'reminder' | 'payment' | 'insight' | 'system';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Insight {
  id: string;
  tone: 'attention' | 'info' | 'positive';
  text: string;
  link?: string;
}

export interface Dashboard {
  date: string;
  summary: {
    total: number;
    completed: number;
    pending: number;
    noShows: number;
    remaining: number;
    revenue: number | null;
  };
  flow: Appointment[];
  availableSlots: { time: string; freeStaff: number }[];
  insights: Insight[];
}

export interface Analytics {
  range: { days: number; from: string; to: string };
  totals: {
    revenue: number;
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
    averageTicket: number;
  };
  revenue: {
    daily: { date: string; label: string; revenue: number }[];
    weekly: { label: string; revenue: number }[];
    monthly: { label: string; revenue: number }[];
  };
  appointmentsByStatus: { status: AppointmentStatus; count: number }[];
  popularServices: { name: string; count: number; revenue: number }[];
  staffPerformance: {
    id: string;
    name: string;
    color: string;
    total: number;
    completed: number;
    noShows: number;
    revenue: number;
  }[];
  customers: { new: number; returning: number; inactive: number };
  payments: {
    byMethod: { method: PaymentMethod; amount: number; count: number }[];
    byStatus: { status: PaymentStatus; count: number }[];
    outstanding: number;
    recent: PaymentRow[];
  };
}

export interface SearchResults {
  customers: { id: string; name: string; phone: string; email: string }[];
  appointments: {
    id: string;
    customerName: string;
    serviceName: string;
    staffName: string;
    date: string;
    startTime: string;
    status: AppointmentStatus;
  }[];
  services: { id: string; name: string; category: string; price: number; durationMinutes: number }[];
}

export interface AssistantReply {
  reply: string;
  items: { label: string; detail?: string; link?: string }[];
  suggestions: string[];
  source: 'built-in' | 'claude';
}

export interface StudioSettings {
  id: string;
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  timezone: string;
}

export interface SessionInfo {
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginAgent: string | null;
  accountCreatedAt: string;
}
