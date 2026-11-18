const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to check allergy conflicts
function checkAllergyConflict(medicineName, allergyString) {
  if (!medicineName || !allergyString || allergyString.toLowerCase() === 'none') {
    return null;
  }

  const allergies = allergyString.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
  const med = medicineName.toLowerCase();

  for (const allergy of allergies) {
    // Check direct substring match or common family match
    if (med.includes(allergy) || allergy.includes(med)) {
      return allergy;
    }
    // Common antibiotic cross-sensitivities
    if (allergy.includes('penicillin') && (med.includes('amoxicillin') || med.includes('ampicillin') || med.includes('augmentin'))) {
      return `${allergy} cross-reactivity with ${medicineName}`;
    }
    if (allergy.includes('aspirin') && (med.includes('nsaid') || med.includes('ibuprofen') || med.includes('naproxen'))) {
      return `${allergy} cross-reactivity with NSAID ${medicineName}`;
    }
  }

  return null;
}

// GET /api/doctor/patient/:phid: Enforces PHID-scoped access & returns 3-Line AI Clinical Brief + Trends
router.get('/patient/:phid', async (req, res) => {
  try {
    const { phid } = req.params;
    const patient = await db.findUserByPhid(phid);

    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient with PHID ${phid} not found.` });
    }

    // 1. Fetch patient's medical records and prescriptions
    const records = await db.getMedicalRecordsByPatient(patient.id);
    const prescriptions = await db.getPrescriptionsByPatient(patient.id);

    // 2. Build 3-Line AI Clinical Brief
    // Line 1: Chronic conditions + [ALLERGY ALERT] badges
    const allergiesList = (patient.allergies && patient.allergies.toLowerCase() !== 'none') ? patient.allergies : 'None Reported';
    const chronicList = (patient.chronic_conditions && patient.chronic_conditions.toLowerCase() !== 'none') ? patient.chronic_conditions : 'No Chronic Conditions';
    const line1 = `Conditions: ${chronicList} | Allergy Alert: [${allergiesList.toUpperCase()}]`;

    // Line 2: Most recent abnormal lab biomarkers
    let abnormalFindings = [];
    if (records.length > 0 && records[0].extracted_biomarkers) {
      const latestBiomarkers = Array.isArray(records[0].extracted_biomarkers)
        ? records[0].extracted_biomarkers
        : JSON.parse(records[0].extracted_biomarkers || '[]');
      
      const abnormals = latestBiomarkers.filter(b => b.status === 'HIGH' || b.status === 'LOW' || b.status === 'CRITICAL');
      abnormalFindings = abnormals.map(b => `${b.test_name} ${b.status} (${b.value} ${b.unit})`);
    }
    const line2 = abnormalFindings.length > 0 
      ? `Recent Abnormal Labs: ${abnormalFindings.join(', ')}` 
      : 'Recent Abnormal Labs: All documented lab biomarkers are within normal limits.';

    // Line 3: Active medications from last prescription
    let activeMeds = 'None on file';
    if (prescriptions.length > 0 && prescriptions[0].medicines) {
      const meds = Array.isArray(prescriptions[0].medicines)
        ? prescriptions[0].medicines
        : JSON.parse(prescriptions[0].medicines || '[]');
      if (meds.length > 0) {
        activeMeds = meds.map(m => `${m.name} (${m.dosage || ''})`).join(', ');
      }
    }
    const line3 = `Active Medications: ${activeMeds}`;

    // 3. Prepare Longitudinal biomarker history for trend charts (e.g., Blood Glucose, HbA1c, Creatinine)
    const trendData = {
      dates: [],
      glucose: [],
      hba1c: [],
      creatinine: []
    };

    // Sort records chronologically (oldest to newest) for chart plotting
    const chronologicalRecords = [...records].reverse();
    for (const rec of chronologicalRecords) {
      const d = rec.report_date || 'Date';
      const biomarkers = Array.isArray(rec.extracted_biomarkers)
        ? rec.extracted_biomarkers
        : JSON.parse(rec.extracted_biomarkers || '[]');

      const fbs = biomarkers.find(b => b.test_name.toLowerCase().includes('glucose') || b.test_name.toLowerCase().includes('fbs'));
      const a1c = biomarkers.find(b => b.test_name.toLowerCase().includes('hba1c'));
      const creat = biomarkers.find(b => b.test_name.toLowerCase().includes('creatinine'));

      if (fbs || a1c || creat) {
        trendData.dates.push(d);
        trendData.glucose.push(fbs ? fbs.value : null);
        trendData.hba1c.push(a1c ? a1c.value : null);
        trendData.creatinine.push(creat ? creat.value : null);
      }
    }

    res.json({
      success: true,
      patient: {
        id: patient.id,
        phid: patient.phid,
        full_name: patient.full_name,
        phone: patient.phone,
        allergies: patient.allergies,
        chronic_conditions: patient.chronic_conditions,
        created_at: patient.created_at
      },
      ai_brief: {
        line1,
        line2,
        line3
      },
      records,
      prescriptions,
      trendData
    });
  } catch (err) {
    console.error('[Doctor Patient Route Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/doctor/prescribe: Real-time allergy check & digital prescription generation
router.post('/prescribe', async (req, res) => {
  try {
    const { appointment_id, patient_id, doctor_id, diagnosis, medicines, advice, force_confirm } = req.body;

    if (!patient_id) {
      return res.status(400).json({ success: false, error: 'patient_id is required' });
    }

    const patient = await db.findUserById(patient_id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    // Safety Guardrail: Check prescribed medicines against patient allergies
    const conflicts = [];
    if (Array.isArray(medicines)) {
      for (const med of medicines) {
        const conflict = checkAllergyConflict(med.name, patient.allergies);
        if (conflict) {
          conflicts.push({
            medicine: med.name,
            allergyMatch: conflict,
            patientAllergies: patient.allergies
          });
        }
      }
    }

    // If conflict detected and not explicitly confirmed by the doctor, stop and alert
    if (conflicts.length > 0 && !force_confirm) {
      return res.status(409).json({
        success: false,
        warning: 'ALLERGY_CONFLICT_DETECTED',
        message: `Prescription contains medication matching patient's known allergy (${conflicts.map(c => `${c.medicine} conflicts with ${c.allergyMatch}`).join('; ')}). Confirmation required to proceed.`,
        conflicts
      });
    }

    // Save prescription
    const prescription = await db.createPrescription({
      appointment_id: appointment_id || null,
      patient_id: Number(patient_id),
      doctor_id: Number(doctor_id) || 1,
      diagnosis: diagnosis || 'General Health Consultation',
      medicines: medicines || [],
      advice: advice || ''
    });

    // If linked to active appointment, complete it
    if (appointment_id) {
      await db.updateAppointment(appointment_id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Prescription successfully recorded',
      prescription,
      conflicts_overridden: conflicts.length > 0
    });
  } catch (err) {
    console.error('[Prescribe Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
