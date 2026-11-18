// Doctor Clinical Cockpit & Prescription Pad JavaScript
let activePatient = null;
let activeAppointment = null;
let trendChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  initDoctorSocket();
  await syncActivePatient();

  // Next patient quick sync button
  const btnNext = document.getElementById('btnSyncNextPatient');
  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      await fetch('/api/queue/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'call_next' })
      });
      await syncActivePatient();
    });
  }

  // Prescription Form Handler
  const rxForm = document.getElementById('prescriptionForm');
  if (rxForm) {
    rxForm.addEventListener('submit', handleSavePrescription);
  }

  // Add Medicine Row Handler
  const btnAddMed = document.getElementById('btnAddMedicineRow');
  if (btnAddMed) {
    btnAddMed.addEventListener('click', addMedicineRow);
  }

  // Initial Medicine input listeners for allergy checking
  attachMedicineInputListeners();
});

function initDoctorSocket() {
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.emit('register', { role: 'doctor' });

    socket.on('queue:updated', () => {
      syncActivePatient();
    });
  }
}

async function syncActivePatient() {
  try {
    const qRes = await fetch('/api/queue/active');
    const qData = await qRes.json();

    if (qData.success && qData.in_chamber) {
      activeAppointment = qData.in_chamber;
      await loadPatientClinicalData(activeAppointment.phid);
    } else {
      // Default to demo patient if chamber is empty
      await loadPatientClinicalData('CT-2026-8492');
    }
  } catch (err) {
    console.error('Failed to sync active patient:', err);
  }
}

async function loadPatientClinicalData(phid) {
  try {
    const res = await fetch(`/api/doctor/patient/${phid}`);
    const data = await res.json();

    if (data.success) {
      activePatient = data.patient;
      renderPatientHeader(data.patient, activeAppointment);
      renderClinicalBrief(data.ai_brief, data.patient.allergies);
      renderTrendChart(data.trendData);
      renderRecentLabs(data.records);
      checkPrescriptionAllergies(); // Check current rows against this patient
    }
  } catch (err) {
    console.error('Error loading patient clinical records:', err);
  }
}

function renderPatientHeader(patient, appt) {
  const nameEl = document.getElementById('docPatientName');
  const phidEl = document.getElementById('docPatientPhid');
  const visitTypeEl = document.getElementById('docVisitType');
  const tokenEl = document.getElementById('docPatientToken');

  if (nameEl) nameEl.textContent = patient.full_name;
  if (phidEl) phidEl.textContent = patient.phid;
  if (visitTypeEl) visitTypeEl.textContent = appt ? appt.visit_type : 'Clinical Consultation';
  if (tokenEl) tokenEl.textContent = appt ? `#${String(appt.serial_number).padStart(2, '0')}` : '#01';
}

function renderClinicalBrief(brief, allergies) {
  const briefBox = document.getElementById('aiClinicalBriefBox');
  if (!briefBox || !brief) return;

  const allergyBadges = (allergies && allergies.toLowerCase() !== 'none')
    ? allergies.split(',').map(a => `<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 ml-1.5">${a.trim()}</span>`).join('')
    : '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300 ml-1.5">No Known Drug Allergies</span>';

  briefBox.innerHTML = `
    <div class="space-y-2.5">
      <div class="text-sm text-slate-800 font-medium flex flex-wrap items-center">
        <span class="font-bold text-slate-900 mr-1.5">Line 1 (Conditions & Allergies):</span>
        <span>${brief.line1.split('|')[0].trim()}</span>
        <div class="mt-1 sm:mt-0 flex items-center">${allergyBadges}</div>
      </div>
      <div class="text-sm text-slate-800 font-medium">
        <span class="font-bold text-slate-900">Line 2 (Lab Abnormalities):</span>
        <span class="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 ml-1">${brief.line2.replace('Recent Abnormal Labs:', '').trim()}</span>
      </div>
      <div class="text-sm text-slate-800 font-medium">
        <span class="font-bold text-slate-900">Line 3 (Active Medications):</span>
        <span class="text-slate-700 font-mono ml-1">${brief.line3.replace('Active Medications:', '').trim()}</span>
      </div>
    </div>
  `;
}

function renderTrendChart(trendData) {
  const ctx = document.getElementById('biomarkerTrendChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (trendChart) {
    trendChart.destroy();
  }

  // Fallback dates if empty
  const labels = (trendData && trendData.dates && trendData.dates.length > 0)
    ? trendData.dates
    : ['Oct 04', 'Nov 15'];
  
  const glucoseData = (trendData && trendData.glucose && trendData.glucose.length > 0)
    ? trendData.glucose
    : [172, 154];
  
  const a1cData = (trendData && trendData.hba1c && trendData.hba1c.length > 0)
    ? trendData.hba1c
    : [8.5, 7.9];

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Fasting Glucose (mg/dL)',
          data: glucoseData,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.2,
          pointRadius: 5,
          pointBackgroundColor: '#2563EB',
          yAxisID: 'y'
        },
        {
          label: 'HbA1c (%)',
          data: a1cData,
          borderColor: '#DC2626',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderDash: [5, 5],
          tension: 0.2,
          pointRadius: 5,
          pointBackgroundColor: '#DC2626',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { size: 12, weight: 'bold' }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Glucose (mg/dL)' },
          suggestedMin: 60,
          suggestedMax: 200
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'HbA1c (%)' },
          grid: { drawOnChartArea: false },
          suggestedMin: 4.0,
          suggestedMax: 10.0
        }
      }
    }
  });
}

function renderRecentLabs(records) {
  const tableBody = document.getElementById('docLabTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!records || records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-500 text-sm">No lab results available.</td></tr>`;
    return;
  }

  // Get biomarkers from the most recent record
  const latest = records[0];
  const biomarkers = Array.isArray(latest.extracted_biomarkers)
    ? latest.extracted_biomarkers
    : JSON.parse(latest.extracted_biomarkers || '[]');

  biomarkers.forEach(b => {
    let badgeClass = 'bg-green-100 text-green-800 border-green-300';
    if (b.status === 'HIGH' || b.status === 'LOW') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (b.status === 'CRITICAL') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300 font-bold';
    }

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200 hover:bg-slate-50 text-sm';
    tr.innerHTML = `
      <td class="p-2.5 font-semibold text-slate-900">${b.test_name}</td>
      <td class="p-2.5 font-mono font-medium text-slate-800">${b.value} ${b.unit}</td>
      <td class="p-2.5 text-slate-500 text-xs">${b.ref_range || 'Normal'}</td>
      <td class="p-2.5">
        <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${badgeClass}">
          ${b.status}
        </span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function addMedicineRow() {
  const container = document.getElementById('medicineListRows');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'medicine-row grid grid-cols-12 gap-2 mb-2 items-center';
  row.innerHTML = `
    <div class="col-span-5">
      <input type="text" class="med-name w-full min-h-[44px] px-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Medicine Name (e.g. Ciprofloxacin)" required />
    </div>
    <div class="col-span-4">
      <input type="text" class="med-dose w-full min-h-[44px] px-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Dosage (1+0+1)" required />
    </div>
    <div class="col-span-2">
      <input type="text" class="med-dur w-full min-h-[44px] px-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Days (7 d)" />
    </div>
    <div class="col-span-1 text-center">
      <button type="button" onclick="this.closest('.medicine-row').remove(); checkPrescriptionAllergies();" class="text-slate-400 hover:text-red-600 text-lg font-bold p-1">✕</button>
    </div>
  `;
  container.appendChild(row);
  attachMedicineInputListeners();
}

function attachMedicineInputListeners() {
  document.querySelectorAll('.med-name').forEach(input => {
    input.removeEventListener('input', checkPrescriptionAllergies);
    input.addEventListener('input', checkPrescriptionAllergies);
  });
}

function checkPrescriptionAllergies() {
  const alertBox = document.getElementById('allergyWarningAlertBox');
  if (!alertBox || !activePatient || !activePatient.allergies || activePatient.allergies.toLowerCase() === 'none') {
    if (alertBox) alertBox.classList.add('hidden');
    return;
  }

  const patientAllergies = activePatient.allergies.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
  const enteredMeds = Array.from(document.querySelectorAll('.med-name'))
    .map(i => i.value.trim().toLowerCase())
    .filter(Boolean);

  let detectedConflicts = [];

  for (const med of enteredMeds) {
    for (const allergy of patientAllergies) {
      if (med.includes(allergy) || allergy.includes(med)) {
        detectedConflicts.push({ med, allergy });
      } else if (allergy.includes('penicillin') && (med.includes('amox') || med.includes('amp') || med.includes('augmentin'))) {
        detectedConflicts.push({ med, allergy: 'Penicillin (Cross-reactive)' });
      } else if (allergy.includes('aspirin') && (med.includes('nsaid') || med.includes('ibuprofen') || med.includes('naproxen'))) {
        detectedConflicts.push({ med, allergy: 'Aspirin/NSAID (Cross-reactive)' });
      }
    }
  }

  if (detectedConflicts.length > 0) {
    const list = detectedConflicts.map(c => `<strong>${c.med.toUpperCase()}</strong> conflicts with recorded allergy: <span class="underline">${c.allergy}</span>`).join('<br>');
    alertBox.innerHTML = `
      <div class="p-3.5 bg-red-100 border-2 border-red-500 rounded-lg text-red-900 text-sm">
        <div class="flex items-center gap-2 font-bold text-base mb-1 text-red-800">
          <span>⚠️</span> ALLERGY SAFETY WARNING!
        </div>
        <div>${list}</div>
        <p class="text-xs text-red-700 mt-1.5 font-medium">Please select an alternative drug or provide explicit confirmation before saving.</p>
      </div>
    `;
    alertBox.classList.remove('hidden');
  } else {
    alertBox.classList.add('hidden');
  }
}

async function handleSavePrescription(e) {
  e.preventDefault();
  if (!activePatient) {
    alert('No active patient selected.');
    return;
  }

  const diagnosis = document.getElementById('prescriptionDiagnosis').value;
  const advice = document.getElementById('prescriptionAdvice').value;

  const medRows = document.querySelectorAll('.medicine-row');
  const medicines = [];
  medRows.forEach(row => {
    const name = row.querySelector('.med-name')?.value.trim();
    const dosage = row.querySelector('.med-dose')?.value.trim();
    const duration = row.querySelector('.med-dur')?.value.trim();
    if (name) {
      medicines.push({ name, dosage, duration });
    }
  });

  const payload = {
    appointment_id: activeAppointment ? activeAppointment.id : null,
    patient_id: activePatient.id,
    doctor_id: 1,
    diagnosis,
    medicines,
    advice,
    force_confirm: false
  };

  try {
    let res = await fetch('/api/doctor/prescribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = await res.json();

    if (res.status === 409 && data.warning === 'ALLERGY_CONFLICT_DETECTED') {
      const confirmOverride = confirm(data.message + '\n\nDo you wish to OVERRIDE this warning and proceed?');
      if (confirmOverride) {
        payload.force_confirm = true;
        res = await fetch('/api/doctor/prescribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      } else {
        return;
      }
    }

    if (data.success) {
      alert('Prescription successfully saved and consultation completed!');
      document.getElementById('prescriptionForm').reset();
      await syncActivePatient();
    } else {
      alert(data.error || 'Failed to save prescription');
    }
  } catch (err) {
    alert('Error saving prescription: ' + err.message);
  }
}
