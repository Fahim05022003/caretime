-- CareTime Database Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phid VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(20) CHECK (role IN ('patient', 'assistant', 'doctor')) NOT NULL,
    specialty VARCHAR(100) NULL,
    allergies TEXT DEFAULT 'None',
    chronic_conditions TEXT DEFAULT 'None',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queue_sessions (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES users(id),
    session_date DATE DEFAULT CURRENT_DATE,
    current_serving_token INT DEFAULT 0,
    doctor_delay_mins INT DEFAULT 0,
    avg_consult_mins FLOAT DEFAULT 10.0,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES queue_sessions(id),
    patient_id INT REFERENCES users(id),
    serial_number INT NOT NULL,
    visit_type VARCHAR(30) CHECK (visit_type IN ('New Checkup', 'Follow-up', 'Report Show')) NOT NULL,
    is_emergency BOOLEAN DEFAULT FALSE,
    predicted_eta_mins INT DEFAULT 0,
    alert_45_sent BOOLEAN DEFAULT FALSE,
    alert_10_sent BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_chamber', 'completed', 'absent')),
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES users(id),
    report_title VARCHAR(150),
    report_date DATE DEFAULT CURRENT_DATE,
    file_path TEXT,
    extracted_biomarkers JSONB,
    ai_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    appointment_id INT REFERENCES appointments(id),
    patient_id INT REFERENCES users(id),
    doctor_id INT REFERENCES users(id),
    diagnosis TEXT,
    medicines JSONB,
    advice TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
