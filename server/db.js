const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, '..', 'database', 'data.json');

let pool = null;
let usePg = false;

// Fallback in-memory/file storage
let localStore = {
  users: [],
  queue_sessions: [],
  appointments: [],
  medical_records: [],
  prescriptions: [],
  sequences: {
    users: 1,
    queue_sessions: 1,
    appointments: 1,
    medical_records: 1,
    prescriptions: 1
  }
};

function loadLocalStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      localStore = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[DB] Could not load local data file, initializing fresh store:', err.message);
  }
}

// Load immediately on module load
loadLocalStore();

function saveLocalStore() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(localStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Failed to save local store:', err.message);
  }
}

async function initDb() {
  loadLocalStore();

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      pool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 2500
      });
      const client = await pool.connect();
      console.log('[DB] Connected to PostgreSQL successfully.');
      usePg = true;

      // Run schema if exists
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('[DB] PostgreSQL schema verified/initialized.');
      }
      client.release();
    } catch (err) {
      console.warn('[DB] PostgreSQL not reachable (' + err.message + '). Automatically using persistent local store.');
      usePg = false;
      if (pool) {
        pool.end().catch(() => {});
        pool = null;
      }
    }
  } else {
    console.log('[DB] No DATABASE_URL provided. Using persistent local store.');
  }
}

// Data Access Layer
const db = {
  initDb,
  isUsingPg: () => usePg,

  // Users
  async findUserByPhone(phone) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
      return res.rows[0] || null;
    }
    return localStore.users.find(u => u.phone === phone) || null;
  },

  async findUserByPhid(phid) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM users WHERE phid = $1', [phid]);
      return res.rows[0] || null;
    }
    return localStore.users.find(u => u.phid.toUpperCase() === phid.toUpperCase()) || null;
  },

  async findUserById(id) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return localStore.users.find(u => u.id === Number(id)) || null;
  },

  async getUsersByRole(role) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM users WHERE role = $1 ORDER BY id ASC', [role]);
      return res.rows;
    }
    return localStore.users.filter(u => u.role === role);
  },

  async createUser(userData) {
    if (usePg) {
      const res = await pool.query(
        `INSERT INTO users (phid, full_name, phone, role, specialty, allergies, chronic_conditions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
        [
          userData.phid,
          userData.full_name,
          userData.phone,
          userData.role,
          userData.specialty || null,
          userData.allergies || 'None',
          userData.chronic_conditions || 'None'
        ]
      );
      return res.rows[0];
    }
    const id = localStore.sequences.users++;
    const user = {
      id,
      phid: userData.phid,
      full_name: userData.full_name,
      phone: userData.phone,
      role: userData.role,
      specialty: userData.specialty || null,
      allergies: userData.allergies || 'None',
      chronic_conditions: userData.chronic_conditions || 'None',
      created_at: new Date().toISOString()
    };
    localStore.users.push(user);
    saveLocalStore();
    return user;
  },

  // Queue Sessions
  async getActiveQueueSession(doctorId = null) {
    if (usePg) {
      let query = "SELECT * FROM queue_sessions WHERE status = 'active'";
      const params = [];
      if (doctorId) {
        query += ' AND doctor_id = $1';
        params.push(doctorId);
      }
      query += ' ORDER BY id DESC LIMIT 1';
      const res = await pool.query(query, params);
      return res.rows[0] || null;
    }
    const filtered = localStore.queue_sessions.filter(s => s.status === 'active' && (!doctorId || s.doctor_id === Number(doctorId)));
    return filtered[filtered.length - 1] || null;
  },

  async createQueueSession(sessionData) {
    if (usePg) {
      const res = await pool.query(
        `INSERT INTO queue_sessions (doctor_id, session_date, current_serving_token, doctor_delay_mins, avg_consult_mins, status)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5) RETURNING *`,
        [
          sessionData.doctor_id,
          sessionData.current_serving_token || 0,
          sessionData.doctor_delay_mins || 0,
          sessionData.avg_consult_mins || 10.0,
          sessionData.status || 'active'
        ]
      );
      return res.rows[0];
    }
    const id = localStore.sequences.queue_sessions++;
    const session = {
      id,
      doctor_id: sessionData.doctor_id,
      session_date: new Date().toISOString().split('T')[0],
      current_serving_token: sessionData.current_serving_token || 0,
      doctor_delay_mins: sessionData.doctor_delay_mins || 0,
      avg_consult_mins: sessionData.avg_consult_mins || 10.0,
      status: sessionData.status || 'active'
    };
    localStore.queue_sessions.push(session);
    saveLocalStore();
    return session;
  },

  async updateQueueSession(id, updates) {
    if (usePg) {
      const keys = Object.keys(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = [id, ...keys.map(k => updates[k])];
      const res = await pool.query(`UPDATE queue_sessions SET ${setClauses} WHERE id = $1 RETURNING *`, values);
      return res.rows[0];
    }
    const session = localStore.queue_sessions.find(s => s.id === Number(id));
    if (session) {
      Object.assign(session, updates);
      saveLocalStore();
    }
    return session;
  },

  // Appointments
  async getAppointmentsBySession(sessionId) {
    if (usePg) {
      const res = await pool.query(
        `SELECT a.*, u.full_name as patient_name, u.phone as patient_phone, u.phid, u.allergies, u.chronic_conditions
         FROM appointments a
         JOIN users u ON a.patient_id = u.id
         WHERE a.session_id = $1
         ORDER BY a.is_emergency DESC, a.serial_number ASC`,
        [sessionId]
      );
      return res.rows;
    }
    const list = localStore.appointments
      .filter(a => a.session_id === Number(sessionId))
      .map(a => {
        const u = localStore.users.find(usr => usr.id === a.patient_id) || {};
        return {
          ...a,
          patient_name: u.full_name || 'Unknown',
          patient_phone: u.phone || '',
          phid: u.phid || '',
          allergies: u.allergies || 'None',
          chronic_conditions: u.chronic_conditions || 'None'
        };
      });
    
    // Sort: Emergency waiting first, then by serial_number
    return list.sort((a, b) => {
      if (a.is_emergency !== b.is_emergency) return b.is_emergency ? 1 : -1;
      return a.serial_number - b.serial_number;
    });
  },

  async getAppointmentById(id) {
    if (usePg) {
      const res = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return localStore.appointments.find(a => a.id === Number(id)) || null;
  },

  async getActiveAppointmentForPatient(patientId) {
    if (usePg) {
      const res = await pool.query(
        `SELECT a.*, qs.doctor_id, u.full_name as doctor_name
         FROM appointments a
         JOIN queue_sessions qs ON a.session_id = qs.id
         JOIN users u ON qs.doctor_id = u.id
         WHERE a.patient_id = $1 AND a.status IN ('waiting', 'in_chamber')
         ORDER BY a.id DESC LIMIT 1`,
        [patientId]
      );
      return res.rows[0] || null;
    }
    const active = localStore.appointments
      .filter(a => a.patient_id === Number(patientId) && (a.status === 'waiting' || a.status === 'in_chamber'))
      .pop();
    if (!active) return null;
    const session = localStore.queue_sessions.find(s => s.id === active.session_id);
    const doctor = session ? localStore.users.find(u => u.id === session.doctor_id) : null;
    return {
      ...active,
      doctor_id: session ? session.doctor_id : null,
      doctor_name: doctor ? doctor.full_name : 'Clinic Doctor'
    };
  },

  async createAppointment(apptData) {
    if (usePg) {
      const res = await pool.query(
        `INSERT INTO appointments (session_id, patient_id, serial_number, visit_type, is_emergency, predicted_eta_mins, status, alert_45_sent, alert_10_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          apptData.session_id,
          apptData.patient_id,
          apptData.serial_number,
          apptData.visit_type,
          apptData.is_emergency || false,
          apptData.predicted_eta_mins || 0,
          apptData.status || 'waiting',
          false,
          false
        ]
      );
      return res.rows[0];
    }
    const id = localStore.sequences.appointments++;
    const appt = {
      id,
      session_id: apptData.session_id,
      patient_id: apptData.patient_id,
      serial_number: apptData.serial_number,
      visit_type: apptData.visit_type,
      is_emergency: !!apptData.is_emergency,
      predicted_eta_mins: apptData.predicted_eta_mins || 0,
      alert_45_sent: false,
      alert_10_sent: false,
      status: apptData.status || 'waiting',
      started_at: null,
      completed_at: null
    };
    localStore.appointments.push(appt);
    saveLocalStore();
    return appt;
  },

  async updateAppointment(id, updates) {
    if (usePg) {
      const keys = Object.keys(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = [id, ...keys.map(k => updates[k])];
      const res = await pool.query(`UPDATE appointments SET ${setClauses} WHERE id = $1 RETURNING *`, values);
      return res.rows[0];
    }
    const appt = localStore.appointments.find(a => a.id === Number(id));
    if (appt) {
      Object.assign(appt, updates);
      saveLocalStore();
    }
    return appt;
  },

  // Medical Records
  async getMedicalRecordsByPatient(patientId) {
    if (usePg) {
      const res = await pool.query(
        'SELECT * FROM medical_records WHERE patient_id = $1 ORDER BY id DESC',
        [patientId]
      );
      return res.rows;
    }
    return localStore.medical_records
      .filter(m => m.patient_id === Number(patientId))
      .sort((a, b) => b.id - a.id);
  },

  async createMedicalRecord(recordData) {
    if (usePg) {
      const res = await pool.query(
        `INSERT INTO medical_records (patient_id, report_title, report_date, file_path, extracted_biomarkers, ai_summary, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [
          recordData.patient_id,
          recordData.report_title,
          recordData.report_date || new Date().toISOString().split('T')[0],
          recordData.file_path || '',
          JSON.stringify(recordData.extracted_biomarkers || []),
          recordData.ai_summary || ''
        ]
      );
      return res.rows[0];
    }
    const id = localStore.sequences.medical_records++;
    const record = {
      id,
      patient_id: recordData.patient_id,
      report_title: recordData.report_title,
      report_date: recordData.report_date || new Date().toISOString().split('T')[0],
      file_path: recordData.file_path || '',
      extracted_biomarkers: recordData.extracted_biomarkers || [],
      ai_summary: recordData.ai_summary || '',
      created_at: new Date().toISOString()
    };
    localStore.medical_records.push(record);
    saveLocalStore();
    return record;
  },

  // Prescriptions
  async getPrescriptionsByPatient(patientId) {
    if (usePg) {
      const res = await pool.query(
        `SELECT p.*, u.full_name as doctor_name, u.specialty as doctor_specialty
         FROM prescriptions p
         JOIN users u ON p.doctor_id = u.id
         WHERE p.patient_id = $1
         ORDER BY p.id DESC`,
        [patientId]
      );
      return res.rows;
    }
    return localStore.prescriptions
      .filter(p => p.patient_id === Number(patientId))
      .map(p => {
        const doc = localStore.users.find(u => u.id === p.doctor_id) || {};
        return {
          ...p,
          doctor_name: doc.full_name || 'Consultant',
          doctor_specialty: doc.specialty || 'General Medicine'
        };
      })
      .sort((a, b) => b.id - a.id);
  },

  async createPrescription(prescData) {
    if (usePg) {
      const res = await pool.query(
        `INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, medicines, advice, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [
          prescData.appointment_id || null,
          prescData.patient_id,
          prescData.doctor_id,
          prescData.diagnosis,
          JSON.stringify(prescData.medicines || []),
          prescData.advice || ''
        ]
      );
      return res.rows[0];
    }
    const id = localStore.sequences.prescriptions++;
    const presc = {
      id,
      appointment_id: prescData.appointment_id || null,
      patient_id: prescData.patient_id,
      doctor_id: prescData.doctor_id,
      diagnosis: prescData.diagnosis,
      medicines: prescData.medicines || [],
      advice: prescData.advice || '',
      created_at: new Date().toISOString()
    };
    localStore.prescriptions.push(presc);
    saveLocalStore();
    return presc;
  },

  // Reset or seed helper
  async resetLocalStore(data) {
    localStore = data;
    saveLocalStore();
  }
};

module.exports = db;
