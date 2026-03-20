-- VetSafe Cloud SQL schema (PostgreSQL)

CREATE TABLE roles (
  id SMALLSERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  title VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (code, title) VALUES
  ('owner', 'Owner'),
  ('doctor', 'Doctor'),
  ('clinic_admin', 'Clinic Admin');

CREATE TABLE clinics (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(160),
  phone VARCHAR(40),
  address TEXT,
  timezone VARCHAR(64) DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
  role_id SMALLINT NOT NULL REFERENCES roles(id),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  twofa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pets (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  species VARCHAR(32) NOT NULL,
  breed VARCHAR(80),
  sex VARCHAR(16),
  date_of_birth DATE,
  weight_kg NUMERIC(6,2),
  microchip_id VARCHAR(80),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE visits (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE SET NULL,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  doctor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  triage_risk VARCHAR(16),
  triage_summary TEXT,
  protocol_text TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vaccinations (
  id BIGSERIAL PRIMARY KEY,
  pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_id BIGINT REFERENCES visits(id) ON DELETE SET NULL,
  vaccine_name VARCHAR(140) NOT NULL,
  administered_on DATE NOT NULL,
  next_due_on DATE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lab_results (
  id BIGSERIAL PRIMARY KEY,
  pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_id BIGINT REFERENCES visits(id) ON DELETE SET NULL,
  test_name VARCHAR(140) NOT NULL,
  result_text TEXT,
  result_status VARCHAR(32),
  result_date DATE,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id BIGINT REFERENCES pets(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
  pet_id BIGINT REFERENCES pets(id) ON DELETE SET NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(64) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT,
  action VARCHAR(64) NOT NULL,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_pets_owner_user_id ON pets(owner_user_id);
CREATE INDEX idx_appointments_clinic_starts_at ON appointments(clinic_id, starts_at);
CREATE INDEX idx_visits_pet_id ON visits(pet_id);
CREATE INDEX idx_messages_receiver_read ON messages(receiver_user_id, is_read);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
