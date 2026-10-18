-- FlowDesk database schema (PostgreSQL 13+)
-- Run with: npm run db:setup   (drops and recreates everything, then seeds)

DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS customer_notes CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff_time_off CASCADE;
DROP TABLE IF EXISTS staff_availability CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS studios CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE studios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(150) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  phone         VARCHAR(40) NOT NULL DEFAULT '',
  email         VARCHAR(200) NOT NULL DEFAULT '',
  address       VARCHAR(300) NOT NULL DEFAULT '',
  currency      VARCHAR(8) NOT NULL DEFAULT 'ETB',
  timezone      VARCHAR(60) NOT NULL DEFAULT 'Africa/Addis_Ababa',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id      UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(200) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'staff')),
  phone          VARCHAR(40) NOT NULL DEFAULT '',
  avatar_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  notification_prefs JSONB NOT NULL DEFAULT
    '{"appointment_reminders": true, "email_notifications": true, "booking_notifications": true, "cancellation_notifications": true}'::jsonb,
  last_login_at  TIMESTAMPTZ,
  last_login_ip  VARCHAR(80),
  last_login_agent TEXT,
  token_version  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_studio ON users(studio_id);

CREATE TABLE staff (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id      UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(200) NOT NULL,
  phone        VARCHAR(40) NOT NULL DEFAULT '',
  role_title   VARCHAR(80) NOT NULL DEFAULT 'Stylist',
  specialties  TEXT[] NOT NULL DEFAULT '{}',
  status       VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  avatar_url   TEXT,
  avatar_color VARCHAR(9) NOT NULL DEFAULT '#8a5a83',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_studio ON staff(studio_id);

CREATE TABLE staff_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  is_working   BOOLEAN NOT NULL DEFAULT TRUE,
  start_time   TIME NOT NULL DEFAULT '09:00',
  end_time     TIME NOT NULL DEFAULT '17:00',
  UNIQUE (staff_id, day_of_week),
  CHECK (end_time > start_time)
);

CREATE TABLE staff_time_off (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      VARCHAR(200) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_time_off_staff ON staff_time_off(staff_id, start_date, end_date);

CREATE TABLE service_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id  UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name       VARCHAR(80) NOT NULL,
  UNIQUE (studio_id, name)
);

CREATE TABLE services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  category_id      UUID NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
  name             VARCHAR(120) NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 720),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_studio ON services(studio_id);
CREATE INDEX idx_services_category ON services(category_id);

CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(40) NOT NULL DEFAULT '',
  email       VARCHAR(200) NOT NULL DEFAULT '',
  preferred_service  VARCHAR(120) NOT NULL DEFAULT '',
  preferred_staff    VARCHAR(120) NOT NULL DEFAULT '',
  scheduling_preference VARCHAR(200) NOT NULL DEFAULT '',
  status      VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_studio ON customers(studio_id);
CREATE INDEX idx_customers_name ON customers(studio_id, lower(name));

CREATE TABLE customer_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL CHECK (length(body) > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_id, created_at DESC);

CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id       UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  staff_id         UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  appointment_date DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  status           VARCHAR(12) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show')),
  payment_status   VARCHAR(10) NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  notes            TEXT NOT NULL DEFAULT '',
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  reminder_sent_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_appt_studio_date ON appointments(studio_id, appointment_date);
CREATE INDEX idx_appt_staff_date ON appointments(staff_id, appointment_date);
CREATE INDEX idx_appt_customer ON appointments(customer_id);
CREATE INDEX idx_appt_service ON appointments(service_id);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  method          VARCHAR(15) NOT NULL CHECK (method IN ('cash','bank_transfer','telebirr','card','other')),
  status          VARCHAR(10) NOT NULL CHECK (status IN ('unpaid','partial','paid','refunded')),
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id) -- one payment record per appointment
);
CREATE INDEX idx_payments_studio ON payments(studio_id, paid_at);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = visible to the whole studio
  type        VARCHAR(20) NOT NULL CHECK (type IN ('booking','confirmation','cancellation','reminder','payment','insight','system')),
  title       VARCHAR(160) NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  link        VARCHAR(200),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(studio_id, user_id, is_read, created_at DESC);

CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(128) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id       UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  action          VARCHAR(40) NOT NULL,
  description     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_customer ON activity_logs(customer_id, created_at DESC);
CREATE INDEX idx_activity_studio ON activity_logs(studio_id, created_at DESC);
