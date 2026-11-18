const path = require('path');
const fs = require('fs');

async function seed() {
  console.log('[Seed] Populating CareTime database with realistic clinical outpatient data...');

  const DATA_FILE = path.join(__dirname, 'data.json');

  const users = [
    {
      id: 1,
      phid: 'CT-DOC-1001',
      full_name: 'Dr. Mahmudul Hasan',
      phone: '01711000001',
      role: 'doctor',
      specialty: 'Internal Medicine & Diabetology',
      allergies: 'None',
      chronic_conditions: 'None',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      phid: 'CT-AST-2001',
      full_name: 'Rafiul Islam',
      phone: '01711000002',
      role: 'assistant',
      specialty: null,
      allergies: 'None',
      chronic_conditions: 'None',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      phid: 'CT-2026-8492',
      full_name: 'Farhana Akhter',
      phone: '01811223344',
      role: 'patient',
      specialty: null,
      allergies: 'Penicillin, Amoxicillin',
      chronic_conditions: 'Type 2 Diabetes, Hypertension',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      phid: 'CT-2026-5120',
      full_name: 'Abdur Rahim',
      phone: '01911334455',
      role: 'patient',
      specialty: null,
      allergies: 'Aspirin, NSAIDs',
      chronic_conditions: 'Asthma, GERD',
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      phid: 'CT-2026-3814',
      full_name: 'Nazmul Huda',
      phone: '01711445566',
      role: 'patient',
      specialty: null,
      allergies: 'Sulfa Drugs',
      chronic_conditions: 'Dyslipidemia, Fatty Liver',
      created_at: new Date().toISOString()
    },
    {
      id: 6,
      phid: 'CT-2026-7291',
      full_name: 'Rokeya Begum',
      phone: '01611556677',
      role: 'patient',
      specialty: null,
      allergies: 'None',
      chronic_conditions: 'Osteoarthritis, Chronic Kidney Disease Stage 2',
      created_at: new Date().toISOString()
    },
    {
      id: 7,
      phid: 'CT-2026-9043',
      full_name: 'Tanvir Ahmed',
      phone: '01511667788',
      role: 'patient',
      specialty: null,
      allergies: 'None',
      chronic_conditions: 'Migraine',
      created_at: new Date().toISOString()
    },
    {
      id: 8,
      phid: 'CT-2026-1185',
      full_name: 'Kamal Hossain',
      phone: '01311778899',
      role: 'patient',
      specialty: null,
      allergies: 'Ciprofloxacin',
      chronic_conditions: 'Ischemic Heart Disease',
      created_at: new Date().toISOString()
    }
  ];

  const queue_sessions = [
    {
      id: 1,
      doctor_id: 1,
      session_date: new Date().toISOString().split('T')[0],
      current_serving_token: 1,
      doctor_delay_mins: 0,
      avg_consult_mins: 10.0,
      status: 'active'
    }
  ];

  const appointments = [
    {
      id: 1,
      session_id: 1,
      patient_id: 3, // Farhana Akhter
      serial_number: 1,
      visit_type: 'New Checkup',
      is_emergency: false,
      predicted_eta_mins: 0,
      alert_45_sent: true,
      alert_10_sent: true,
      status: 'in_chamber',
      started_at: new Date(Date.now() - 5 * 60000).toISOString(),
      completed_at: null
    },
    {
      id: 2,
      session_id: 1,
      patient_id: 4, // Abdur Rahim
      serial_number: 2,
      visit_type: 'Follow-up',
      is_emergency: false,
      predicted_eta_mins: 9,
      alert_45_sent: true,
      alert_10_sent: true,
      status: 'waiting',
      started_at: null,
      completed_at: null
    },
    {
      id: 3,
      session_id: 1,
      patient_id: 5, // Nazmul Huda
      serial_number: 3,
      visit_type: 'Report Show',
      is_emergency: false,
      predicted_eta_mins: 18,
      alert_45_sent: true,
      alert_10_sent: false,
      status: 'waiting',
      started_at: null,
      completed_at: null
    },
    {
      id: 4,
      session_id: 1,
      patient_id: 6, // Rokeya Begum
      serial_number: 4,
      visit_type: 'New Checkup',
      is_emergency: false,
      predicted_eta_mins: 32,
      alert_45_sent: true,
      alert_10_sent: false,
      status: 'waiting',
      started_at: null,
      completed_at: null
    },
    {
      id: 5,
      session_id: 1,
      patient_id: 7, // Tanvir Ahmed
      serial_number: 5,
      visit_type: 'Follow-up',
      is_emergency: false,
      predicted_eta_mins: 46,
      alert_45_sent: false,
      alert_10_sent: false,
      status: 'waiting',
      started_at: null,
      completed_at: null
    },
    {
      id: 6,
      session_id: 1,
      patient_id: 8, // Kamal Hossain
      serial_number: 6,
      visit_type: 'New Checkup',
      is_emergency: false,
      predicted_eta_mins: 60,
      alert_45_sent: false,
      alert_10_sent: false,
      status: 'waiting',
      started_at: null,
      completed_at: null
    }
  ];

  const medical_records = [
    {
      id: 1,
      patient_id: 3, // Farhana Akhter
      report_title: 'Comprehensive Metabolic & Lipid Panel',
      report_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      file_path: 'uploads/sample_report_farhana_1.pdf',
      extracted_biomarkers: [
        {
          test_name: 'Fasting Blood Glucose',
          value: 154.0,
          unit: 'mg/dL',
          ref_range: '70 - 100',
          status: 'HIGH'
        },
        {
          test_name: 'HbA1c',
          value: 7.9,
          unit: '%',
          ref_range: '4.0 - 5.6',
          status: 'HIGH'
        },
        {
          test_name: 'Serum Creatinine',
          value: 1.15,
          unit: 'mg/dL',
          ref_range: '0.6 - 1.2',
          status: 'NORMAL'
        },
        {
          test_name: 'Total Cholesterol',
          value: 235.0,
          unit: 'mg/dL',
          ref_range: '125 - 200',
          status: 'HIGH'
        },
        {
          test_name: 'Hemoglobin',
          value: 12.8,
          unit: 'g/dL',
          ref_range: '12.0 - 16.5',
          status: 'NORMAL'
        },
        {
          test_name: 'SGPT / ALT',
          value: 42.0,
          unit: 'U/L',
          ref_range: '7 - 56',
          status: 'NORMAL'
        }
      ],
      ai_summary: 'Abnormal findings: Fasting Blood Glucose HIGH (154.0 mg/dL); HbA1c HIGH (7.9 %); Total Cholesterol HIGH (235.0 mg/dL). Poor glycemic control detected.',
      created_at: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      id: 2,
      patient_id: 3, // Earlier report for trend graph
      report_title: 'Baseline Fasting Blood Sugar & HbA1c',
      report_date: new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0],
      file_path: 'uploads/sample_report_farhana_0.pdf',
      extracted_biomarkers: [
        {
          test_name: 'Fasting Blood Glucose',
          value: 172.0,
          unit: 'mg/dL',
          ref_range: '70 - 100',
          status: 'HIGH'
        },
        {
          test_name: 'HbA1c',
          value: 8.5,
          unit: '%',
          ref_range: '4.0 - 5.6',
          status: 'HIGH'
        },
        {
          test_name: 'Serum Creatinine',
          value: 1.10,
          unit: 'mg/dL',
          ref_range: '0.6 - 1.2',
          status: 'NORMAL'
        }
      ],
      ai_summary: 'Fasting Blood Glucose HIGH (172.0 mg/dL); HbA1c HIGH (8.5 %). Initial diabetic workup.',
      created_at: new Date(Date.now() - 45 * 86400000).toISOString()
    }
  ];

  const prescriptions = [
    {
      id: 1,
      appointment_id: null,
      patient_id: 3,
      doctor_id: 1,
      diagnosis: 'Type 2 Diabetes Mellitus with Essential Hypertension',
      medicines: [
        { name: 'Metformin 500mg', dosage: '1+0+1 after meals', duration: '30 days' },
        { name: 'Amlodipine 5mg', dosage: '0+0+1 at night', duration: '30 days' },
        { name: 'Atorvastatin 10mg', dosage: '0+0+1 at night', duration: '30 days' }
      ],
      advice: 'Low-sugar, low-salt diet. 30 minutes brisk walking daily. Re-check Fasting Glucose and HbA1c in 3 months.',
      created_at: new Date(Date.now() - 45 * 86400000).toISOString()
    }
  ];

  const seedPayload = {
    users,
    queue_sessions,
    appointments,
    medical_records,
    prescriptions,
    sequences: {
      users: 9,
      queue_sessions: 2,
      appointments: 7,
      medical_records: 3,
      prescriptions: 2
    }
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(seedPayload, null, 2), 'utf8');
  console.log('[Seed] Database successfully seeded at:', DATA_FILE);
  console.log('[Seed] 1 Doctor, 1 Assistant, 6 Patients, 1 Active Queue Session with 6 Appointments initialized.');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
