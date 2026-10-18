import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { PublicOnly, RequireAdmin, RequireAuth } from '@/components/RouteGuards';
import { PageSkeleton } from '@/components/ui/Feedback';
import { AppLayout } from '@/layouts/AppLayout';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/pages/auth';
import NotFoundPage from '@/pages/NotFoundPage';

// Heavy pages (charts, calendar) load on demand
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage'));
const AppointmentDetailPage = lazy(() => import('@/pages/AppointmentDetailPage'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage'));
const CustomerDetailPage = lazy(() => import('@/pages/CustomerDetailPage'));
const ServicesPage = lazy(() => import('@/pages/ServicesPage'));
const StaffPage = lazy(() => import('@/pages/StaffPage'));
const StaffDetailPage = lazy(() => import('@/pages/StaffDetailPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route
            element={
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/appointments/:id" element={<AppointmentDetailPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff/:id" element={<StaffDetailPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
