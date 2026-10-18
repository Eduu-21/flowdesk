-- FlowDesk demo data. Dates are relative to the day you run the seed,
-- so the dashboard always looks alive.
--
-- Demo admin:  demo@flowdesk.local  /  DemoPassword123!
-- Demo staff:  marta@flowdesk.local /  DemoPassword123!
--
-- Passwords are hashed with pgcrypto's bcrypt ("bf"), which is compatible
-- with the bcryptjs library used by the API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- "Today" in the seed means today in the demo studio's time zone.
SET TIME ZONE 'Africa/Addis_Ababa';

DO $seed$
DECLARE
  v_studio  UUID;
  v_admin   UUID;
  v_marta_u UUID;
  v_marta   UUID;
  v_hash    TEXT := crypt('DemoPassword123!', gen_salt('bf', 10));

  staff_names TEXT[] := ARRAY['Marta Haile','Hana Girma','Liya Tesfaye','Bethel Assefa','Selam Worku'];
  -- four service names per staff member (padded by repeating)
  svc_map TEXT[][] := ARRAY[
    ARRAY['Box Braids','Hair Styling','Silk Press','Hair Styling'],
    ARRAY['Classic Manicure','Spa Pedicure','Gel Nails','Classic Manicure'],
    ARRAY['Lash Extensions','Soft Glam Makeup','Bridal Package','Soft Glam Makeup'],
    ARRAY['Signature Facial','Beauty Consultation','Deep Hair Treatment','Signature Facial'],
    ARRAY['Hair Styling','Deep Hair Treatment','Box Braids','Hair Styling']
  ];

  i INT; k INT; d INT; dow INT; idx INT; r INT;
  svc TEXT; st TIME; stat TEXT; pay TEXT;
BEGIN
  -- ------------------------------------------------------------------
  -- Studio and users
  -- ------------------------------------------------------------------
  INSERT INTO studios (name, description, phone, email, address, currency, timezone)
  VALUES (
    'Selam Beauty Studio',
    'A calm, modern studio in Bole offering braiding, hair care, nails, skin and bridal beauty.',
    '+251 91 120 4455', 'hello@selambeauty.example', 'Bole Road, Addis Ababa, Ethiopia',
    'ETB', 'Africa/Addis_Ababa')
  RETURNING id INTO v_studio;

  INSERT INTO users (studio_id, name, email, password_hash, role, phone)
  VALUES (v_studio, 'Eden Bekele', 'demo@flowdesk.local', v_hash, 'admin', '+251 91 120 4455')
  RETURNING id INTO v_admin;

  INSERT INTO users (studio_id, name, email, password_hash, role, phone)
  VALUES (v_studio, 'Marta Haile', 'marta@flowdesk.local', v_hash, 'staff', '+251 91 345 7712')
  RETURNING id INTO v_marta_u;

  -- ------------------------------------------------------------------
  -- Staff and availability
  -- ------------------------------------------------------------------
  INSERT INTO staff (studio_id, user_id, name, email, phone, role_title, specialties, avatar_color) VALUES
    (v_studio, v_marta_u, 'Marta Haile',   'marta@flowdesk.local',        '+251 91 345 7712', 'Senior Hair Stylist', ARRAY['Braiding','Hair Styling','Silk Press'], '#7b3f6e'),
    (v_studio, NULL,      'Hana Girma',    'hana@selambeauty.example',    '+251 92 210 8834', 'Nail Technician',     ARRAY['Manicure','Pedicure','Gel Nails'],         '#b0707f'),
    (v_studio, NULL,      'Liya Tesfaye',  'liya@selambeauty.example',    '+251 91 788 2290', 'Makeup & Lash Artist', ARRAY['Makeup','Lash Extensions','Bridal'],      '#8a5a83'),
    (v_studio, NULL,      'Bethel Assefa', 'bethel@selambeauty.example',  '+251 93 456 1120', 'Skin Therapist',      ARRAY['Facials','Hair Treatment','Consultations'], '#a07a9a'),
    (v_studio, NULL,      'Selam Worku',   'selam@selambeauty.example',   '+251 91 902 6641', 'Hair Stylist',        ARRAY['Hair Styling','Hair Treatment','Braiding'], '#9c6b52');

  -- Monday-Saturday working, Sunday off
  INSERT INTO staff_availability (staff_id, day_of_week, is_working, start_time, end_time)
  SELECT s.id, g.dow,
         g.dow <> 0,
         CASE WHEN s.name = 'Bethel Assefa' THEN TIME '10:00' ELSE TIME '09:00' END,
         CASE WHEN s.name = 'Liya Tesfaye' THEN TIME '19:00' ELSE TIME '18:00' END
  FROM staff s CROSS JOIN generate_series(0, 6) AS g(dow)
  WHERE s.studio_id = v_studio;

  INSERT INTO staff_time_off (staff_id, start_date, end_date, reason)
  SELECT id, CURRENT_DATE + 10, CURRENT_DATE + 11, 'Training workshop'
  FROM staff WHERE name = 'Bethel Assefa' AND studio_id = v_studio;

  -- ------------------------------------------------------------------
  -- Services
  -- ------------------------------------------------------------------
  INSERT INTO service_categories (studio_id, name) VALUES
    (v_studio, 'Hair'), (v_studio, 'Nails'), (v_studio, 'Beauty'), (v_studio, 'Bridal');

  INSERT INTO services (studio_id, category_id, name, description, duration_minutes, price, is_active)
  SELECT v_studio, c.id, s.name, s.descr, s.mins, s.price, s.active
  FROM (VALUES
    ('Hair',   'Box Braids',          'Neat, long-lasting box braids with scalp care and finish.',        180, 2800, TRUE),
    ('Hair',   'Hair Styling',        'Wash, blow-dry and styling for everyday or events.',                60,  900, TRUE),
    ('Hair',   'Deep Hair Treatment', 'Moisture and protein treatment to restore strength and shine.',     75, 1200, TRUE),
    ('Hair',   'Silk Press',          'Smooth, silky straightening with heat protection.',                 90, 1500, FALSE),
    ('Nails',  'Classic Manicure',    'Shaping, cuticle care, massage and polish.',                        45,  500, TRUE),
    ('Nails',  'Spa Pedicure',        'Soak, scrub, massage and polish for tired feet.',                   60,  700, TRUE),
    ('Nails',  'Gel Nails',           'Chip-resistant gel colour with a glossy finish.',                   75, 1100, TRUE),
    ('Beauty', 'Signature Facial',    'Deep cleanse, exfoliation, mask and facial massage.',               60, 1400, TRUE),
    ('Beauty', 'Lash Extensions',     'Classic lash extensions, full set.',                               120, 2200, TRUE),
    ('Beauty', 'Soft Glam Makeup',    'Polished, natural makeup for events and photos.',                   75, 1800, TRUE),
    ('Beauty', 'Beauty Consultation', 'A short one-to-one session to plan your look or routine.',          30,  300, TRUE),
    ('Bridal', 'Bridal Package',      'Bridal makeup, hair styling and a trial session.',                 240, 9500, TRUE)
  ) AS s(cat, name, descr, mins, price, active)
  JOIN service_categories c ON c.studio_id = v_studio AND c.name = s.cat;

  -- ------------------------------------------------------------------
  -- Customers (n = creation order; 15-16 have lapsed, 17-18 are brand new)
  -- ------------------------------------------------------------------
  INSERT INTO customers (studio_id, name, phone, email, preferred_service, preferred_staff, scheduling_preference, status, created_at)
  SELECT v_studio, v.name, v.phone, v.email, v.pref_service, v.pref_staff, v.pref_sched, v.status,
         CASE WHEN v.n = 17 THEN now() - INTERVAL '6 days'
              WHEN v.n = 18 THEN now() - INTERVAL '3 days'
              ELSE now() - (150 - v.n * 8) * INTERVAL '1 day' END
  FROM (VALUES
    (1,  'Sara Tesfaye',      '+251 91 112 3401', 'sara.tesfaye@example.com',     'Hair Styling',        'Marta Haile',  'Weekday mornings',        'active'),
    (2,  'Maya Bekele',       '+251 92 234 5502', 'maya.bekele@example.com',      'Box Braids',          'Marta Haile',  'Saturdays',               'active'),
    (3,  'Lina Mulugeta',     '+251 93 345 6603', 'lina.mulugeta@example.com',    'Signature Facial',    'Bethel Assefa','Afternoons after 2 PM',   'active'),
    (4,  'Nadia Abebe',       '+251 91 456 7704', 'nadia.abebe@example.com',      'Soft Glam Makeup',    'Liya Tesfaye', 'Late afternoons',         'active'),
    (5,  'Hiwot Kebede',      '+251 94 567 8805', 'hiwot.kebede@example.com',     'Gel Nails',           'Hana Girma',   'Every second Friday',     'active'),
    (6,  'Rahel Desta',       '+251 91 678 9906', 'rahel.desta@example.com',      'Lash Extensions',     'Liya Tesfaye', 'Monthly refill, mornings','active'),
    (7,  'Tigist Alemayehu',  '+251 92 789 0107', 'tigist.alemayehu@example.com', 'Deep Hair Treatment', 'Selam Worku',  'Weekends',                'active'),
    (8,  'Meron Tadesse',     '+251 93 890 1208', 'meron.tadesse@example.com',    'Spa Pedicure',        'Hana Girma',   'Weekday lunch hours',     'active'),
    (9,  'Betelhem Fikru',    '+251 91 901 2309', 'betelhem.fikru@example.com',   'Box Braids',          'Selam Worku',  'Saturdays',               'active'),
    (10, 'Yodit Haile',       '+251 94 012 3410', 'yodit.haile@example.com',      'Classic Manicure',    'Hana Girma',   'Early mornings',          'active'),
    (11, 'Kidist Negash',     '+251 91 123 4511', 'kidist.negash@example.com',    'Signature Facial',    'Bethel Assefa','Tuesdays',                'active'),
    (12, 'Aster Wolde',       '+251 92 234 5612', 'aster.wolde@example.com',      'Hair Styling',        'Marta Haile',  'Before events',           'active'),
    (13, 'Feven Solomon',     '+251 93 345 6713', 'feven.solomon@example.com',    'Soft Glam Makeup',    'Liya Tesfaye', 'Weekends',                'active'),
    (14, 'Mekdes Yilma',      '+251 91 456 7814', 'mekdes.yilma@example.com',     'Gel Nails',           'Hana Girma',   'Thursdays',               'active'),
    (15, 'Saron Getachew',    '+251 94 567 8915', 'saron.getachew@example.com',   'Hair Styling',        'Selam Worku',  'Flexible',                'active'),
    (16, 'Ruth Hailu',        '+251 92 678 9016', 'ruth.hailu@example.com',       'Beauty Consultation', 'Bethel Assefa','Mornings',                'inactive'),
    (17, 'Bruktawit Teka',    '+251 91 789 0117', 'bruktawit.teka@example.com',   'Bridal Package',      'Liya Tesfaye', 'Wedding in two months',   'active'),
    (18, 'Helen Demissie',    '+251 93 890 1218', 'helen.demissie@example.com',   'Spa Pedicure',        'Hana Girma',   'Evenings',                'active')
  ) AS v(n, name, phone, email, pref_service, pref_staff, pref_sched, status);

  -- ------------------------------------------------------------------
  -- Appointment plan (temp table), then real rows
  -- ------------------------------------------------------------------
  CREATE TEMP TABLE plan (
    d INT, start_time TIME, staff_name TEXT, svc_name TEXT, cidx INT,
    status TEXT, pay TEXT, notes TEXT DEFAULT ''
  ) ON COMMIT DROP;

  -- Hand-written schedule for today
  INSERT INTO plan (d, start_time, staff_name, svc_name, cidx, status, pay, notes) VALUES
    (0, '09:00', 'Marta Haile',   'Hair Styling',        1,  'completed',   'paid',    'Wash and blow-dry for a morning meeting.'),
    (0, '09:30', 'Selam Worku',   'Deep Hair Treatment', 7,  'completed',   'paid',    ''),
    (0, '10:00', 'Bethel Assefa', 'Beauty Consultation', 11, 'completed',   'paid',    'Skin routine review.'),
    (0, '10:30', 'Marta Haile',   'Box Braids',          2,  'in_progress', 'partial', 'Medium length, deposit paid.'),
    (0, '11:00', 'Hana Girma',    'Gel Nails',           5,  'checked_in',  'unpaid',  'Wants a soft nude shade.'),
    (0, '13:30', 'Bethel Assefa', 'Signature Facial',    3,  'confirmed',   'unpaid',  ''),
    (0, '14:00', 'Hana Girma',    'Spa Pedicure',        8,  'pending',     'unpaid',  ''),
    (0, '15:00', 'Liya Tesfaye',  'Soft Glam Makeup',    4,  'confirmed',   'unpaid',  'Birthday dinner.'),
    (0, '16:30', 'Liya Tesfaye',  'Lash Extensions',     6,  'pending',     'unpaid',  'Refill from last month.');

  -- Generated history (last ~75 days) and upcoming weeks
  FOR d IN -75..21 LOOP
    CONTINUE WHEN d = 0;
    dow := EXTRACT(DOW FROM (CURRENT_DATE + d))::INT;
    CONTINUE WHEN dow = 0; -- studio closed on Sundays

    FOR i IN 1..5 LOOP
      -- Bethel is away on her training days
      CONTINUE WHEN i = 4 AND d BETWEEN 10 AND 11;

      FOR k IN 0..1 LOOP
        CONTINUE WHEN (d + 100) * 5 + i * 3 + k * 2 = 0;
        CONTINUE WHEN (((d + 100) * 5 + i * 3 + k * 2) % 4) = 0;

        svc := svc_map[i][1 + (((d + 100) * 7 + i + k) % 4)];
        st := CASE WHEN k = 0 THEN TIME '10:00' ELSE TIME '14:00' END;
        idx := 1 + (((d + 100) * 3 + i * 5 + k * 7) % 18);

        -- brand-new customers only have upcoming bookings
        IF d < 0 AND idx IN (17, 18) THEN idx := idx - 8; END IF;
        -- lapsed customers have not visited recently
        IF d > -40 AND idx IN (15, 16) THEN idx := idx - 8; END IF;

        r := (abs(d) * 13 + i * 7 + k) % 20;

        IF d < 0 THEN
          stat := CASE WHEN r = 0 THEN 'cancelled' WHEN r = 1 THEN 'no_show' ELSE 'completed' END;
          pay  := CASE WHEN stat = 'completed' THEN 'paid'
                       WHEN stat = 'cancelled' AND abs(d) % 2 = 0 THEN 'refunded'
                       ELSE 'unpaid' END;
        ELSIF d <= 3 THEN
          stat := CASE WHEN r % 3 = 0 THEN 'pending' ELSE 'confirmed' END;
          pay  := CASE WHEN r % 5 = 0 THEN 'partial' ELSE 'unpaid' END;
        ELSE
          stat := CASE WHEN r % 4 = 0 THEN 'pending' ELSE 'confirmed' END;
          pay  := 'unpaid';
        END IF;

        INSERT INTO plan (d, start_time, staff_name, svc_name, cidx, status, pay)
        VALUES (d, st, staff_names[i], svc, idx, stat, pay);
      END LOOP;
    END LOOP;
  END LOOP;

  CREATE TEMP TABLE cust_ix ON COMMIT DROP AS
    SELECT id, row_number() OVER (ORDER BY created_at) AS ix
    FROM customers WHERE studio_id = v_studio;

  INSERT INTO appointments (studio_id, customer_id, service_id, staff_id, appointment_date, start_time, end_time,
                            duration_minutes, price, status, payment_status, notes, created_by, created_at)
  SELECT v_studio, ci.id, sv.id, st.id,
         CURRENT_DATE + p.d, p.start_time,
         p.start_time + sv.duration_minutes * INTERVAL '1 minute',
         sv.duration_minutes, sv.price, p.status, p.pay, p.notes, v_admin,
         LEAST((((CURRENT_DATE + p.d) - (2 + p.cidx % 4)) + TIME '09:30')::timestamptz, now() - INTERVAL '1 hour')
  FROM plan p
  JOIN cust_ix ci ON ci.ix = p.cidx
  JOIN services sv ON sv.studio_id = v_studio AND sv.name = p.svc_name
  JOIN staff st ON st.studio_id = v_studio AND st.name = p.staff_name;

  -- Customers should have been created before their first past visit
  UPDATE customers c
  SET created_at = ((m.first_date - 1) + TIME '10:00')::timestamptz
  FROM (SELECT customer_id, min(appointment_date) AS first_date
        FROM appointments WHERE appointment_date < CURRENT_DATE GROUP BY customer_id) m
  WHERE m.customer_id = c.id AND c.created_at > ((m.first_date - 1) + TIME '10:00')::timestamptz;

  -- ------------------------------------------------------------------
  -- Payments
  -- ------------------------------------------------------------------
  INSERT INTO payments (studio_id, appointment_id, customer_id, amount, method, status, paid_at)
  SELECT v_studio, a.id, a.customer_id,
         CASE WHEN a.payment_status = 'paid' THEN a.price ELSE round(a.price * 0.3, 2) END,
         (ARRAY['cash','telebirr','bank_transfer','card','telebirr','cash'])[1 + (abs(hashtext(a.id::text)) % 6)],
         a.payment_status,
         LEAST((a.appointment_date + a.start_time)::timestamptz, now())
  FROM appointments a
  WHERE a.studio_id = v_studio AND a.payment_status IN ('paid', 'partial', 'refunded');

  -- ------------------------------------------------------------------
  -- Activity log (customer timeline)
  -- ------------------------------------------------------------------
  INSERT INTO activity_logs (studio_id, user_id, customer_id, appointment_id, action, description, created_at)
  SELECT v_studio, v_admin, a.customer_id, a.id, 'appointment_created',
         'Booked ' || sv.name || ' with ' || st.name, a.created_at
  FROM appointments a
  JOIN services sv ON sv.id = a.service_id
  JOIN staff st ON st.id = a.staff_id
  WHERE a.studio_id = v_studio;

  INSERT INTO activity_logs (studio_id, user_id, customer_id, appointment_id, action, description, created_at)
  SELECT v_studio, v_admin, a.customer_id, a.id,
         CASE a.status WHEN 'completed' THEN 'appointment_completed'
                       WHEN 'cancelled' THEN 'appointment_cancelled'
                       ELSE 'appointment_no_show' END,
         CASE a.status WHEN 'completed' THEN 'Completed ' || sv.name
                       WHEN 'cancelled' THEN 'Cancelled ' || sv.name
                       ELSE 'Missed ' || sv.name || ' (no show)' END,
         LEAST((a.appointment_date + a.end_time)::timestamptz, now() - INTERVAL '5 minutes')
  FROM appointments a
  JOIN services sv ON sv.id = a.service_id
  WHERE a.studio_id = v_studio AND a.status IN ('completed', 'cancelled', 'no_show')
    AND a.appointment_date <= CURRENT_DATE;

  -- A couple of business notes
  INSERT INTO customer_notes (customer_id, author_id, body, created_at)
  SELECT ci.id, v_admin, n.body, now() - n.age * INTERVAL '1 day'
  FROM (VALUES
    (2,  'Prefers medium-length braids. Usually books the first Saturday of the month.', 20),
    (4,  'Likes to be reminded the day before. Always brings her own lashes for events.', 9),
    (6,  'Lash refills every four weeks, ideally with Liya.', 14),
    (17, 'Wedding date is in about two months. Trial session still to be booked.', 2)
  ) AS n(cidx, body, age)
  JOIN cust_ix ci ON ci.ix = n.cidx;

  -- ------------------------------------------------------------------
  -- Notifications
  -- ------------------------------------------------------------------
  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'booking', 'New booking: ' || c.name,
         sv.name || ' today at ' || to_char(a.start_time, 'HH24:MI'),
         '/appointments/' || a.id, FALSE, now() - INTERVAL '25 minutes'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  WHERE a.appointment_date = CURRENT_DATE AND c.name = 'Lina Mulugeta' LIMIT 1;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'confirmation', c.name || ' confirmed her appointment',
         sv.name || ' today at ' || to_char(a.start_time, 'HH24:MI'),
         '/appointments/' || a.id, FALSE, now() - INTERVAL '2 hours'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  WHERE a.appointment_date = CURRENT_DATE AND c.name = 'Nadia Abebe' LIMIT 1;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'reminder', 'Upcoming appointment today',
         c.name || ' - ' || sv.name || ' at ' || to_char(a.start_time, 'HH24:MI'),
         '/appointments/' || a.id, FALSE, now() - INTERVAL '40 minutes'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  WHERE a.appointment_date = CURRENT_DATE AND a.start_time = TIME '13:30' LIMIT 1;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'insight',
         'You have ' || count(*) || ' unconfirmed appointments',
         'Reach out to these customers to confirm their bookings.',
         '/appointments?status=pending', FALSE, now() - INTERVAL '3 hours'
  FROM appointments WHERE studio_id = v_studio AND status = 'pending' AND appointment_date >= CURRENT_DATE;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'payment', 'Payment received from ' || c.name,
         'ETB ' || a.price || ' for ' || sv.name,
         '/appointments/' || a.id, TRUE, now() - INTERVAL '5 hours'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  WHERE a.appointment_date = CURRENT_DATE AND c.name = 'Sara Tesfaye' LIMIT 1;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_admin, 'cancellation', c.name || ' cancelled an appointment',
         sv.name || ' on ' || to_char(a.appointment_date, 'Mon DD'),
         '/appointments/' || a.id, TRUE, now() - INTERVAL '1 day'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  WHERE a.status = 'cancelled' AND a.appointment_date < CURRENT_DATE
  ORDER BY a.appointment_date DESC LIMIT 1;

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  VALUES (v_studio, v_admin, 'system', 'Welcome to FlowDesk',
          'Your studio is set up. Explore the calendar, customers and analytics.', '/dashboard', TRUE, now() - INTERVAL '2 days');

  INSERT INTO notifications (studio_id, user_id, type, title, message, link, is_read, created_at)
  SELECT v_studio, v_marta_u, 'reminder', 'Your next appointment',
         c.name || ' - ' || sv.name || ' is in progress',
         '/appointments/' || a.id, FALSE, now() - INTERVAL '30 minutes'
  FROM appointments a JOIN customers c ON c.id = a.customer_id JOIN services sv ON sv.id = a.service_id
  JOIN staff s ON s.id = a.staff_id
  WHERE a.appointment_date = CURRENT_DATE AND s.user_id = v_marta_u AND a.status = 'in_progress' LIMIT 1;
END
$seed$;
