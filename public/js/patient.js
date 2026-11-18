// Patient Live Queue, Booking & Health Record Management
let currentUser = null;
let socket = null;
let currentAppointment = null;

// Initialize user and live listeners
document.addEventListener('DOMContentLoaded', async () => {
  const storedUser = localStorage.getItem('caretime_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch (e) {
      currentUser = null;
    }
  }

  // Fallback to sample patient if direct load
  if (!currentUser || currentUser.role !== 'patient') {
    currentUser = {
      id: 3,
      phid: 'CT-2026-8492',
      full_name: 'Farhana Akhter',
      phone: '01811223344',
      role: 'patient',
      allergies: 'Penicillin, Amoxicillin',
      chronic_conditions: 'Type 2 Diabetes, Hypertension'
    };
    localStorage.setItem('caretime_user', JSON.stringify(currentUser));
  }

  renderPatientHeader();
  initSocket();
  await refreshPatientData();
  await loadPastRecords();

  // Booking form handler
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookToken);
  }

  // Report upload form handler
  const uploadForm = document.getElementById('reportUploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadReport);
  }
});

function renderPatientHeader() {
  const nameEl = document.getElementById('patientNameDisplay');
  const phidEl = document.getElementById('patientPhidDisplay');
  const allergiesEl = document.getElementById('patientAllergiesDisplay');

  if (nameEl) nameEl.textContent = currentUser.full_name;
  if (phidEl) phidEl.textContent = currentUser.phid;
  if (allergiesEl) {
    allergiesEl.textContent = currentUser.allergies || 'None';
  }
}

function initSocket() {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.emit('register', { patientId: currentUser.id, role: 'patient' });

    socket.on('queue:updated', (data) => {
      handleQueueUpdate(data);
    });

    socket.on('patient:alert', (alert) => {
      if (alert && (alert.patientId === currentUser.id || !alert.patientId)) {
        displayCommuteAlert(alert);
      }
    });

    socket.on(`patient:alert:${currentUser.id}`, (alert) => {
      displayCommuteAlert(alert);
    });
  }
}

async function refreshPatientData() {
  try {
    const res = await fetch(`/api/queue/patient/${currentUser.id}`);
    const data = await res.json();
    if (data.success) {
      currentAppointment = data.appointment;
      updateQueueDisplay(data.now_serving, currentAppointment, data.in_chamber);
    }
  } catch (err) {
    console.error('Failed to load patient queue status:', err);
  }
}

function handleQueueUpdate(queueState) {
  const nowServingToken = queueState.session ? queueState.session.current_serving_token : 0;
  
  // Check if our appointment is in waiting list or in chamber
  let myAppt = null;
  if (queueState.in_chamber && queueState.in_chamber.patient_id === currentUser.id) {
    myAppt = queueState.in_chamber;
  } else {
    myAppt = queueState.waiting_list.find(a => a.patient_id === currentUser.id);
  }

  currentAppointment = myAppt;
  updateQueueDisplay(nowServingToken, myAppt, queueState.in_chamber);
}

function updateQueueDisplay(nowServing, myAppt, inChamber) {
  const nowServingEl = document.getElementById('nowServingToken');
  const myTokenEl = document.getElementById('myTokenNumber');
  const estWaitEl = document.getElementById('estWaitTime');
  const queueStatusNotice = document.getElementById('queueStatusNotice');
  const bookingBox = document.getElementById('bookingBox');
  const activeTokenCard = document.getElementById('activeTokenCard');

  if (nowServingEl) {
    nowServingEl.textContent = `#${String(nowServing || 0).padStart(2, '0')}`;
  }

  if (myAppt) {
    if (bookingBox) bookingBox.classList.add('hidden');
    if (activeTokenCard) activeTokenCard.classList.remove('hidden');

    if (myTokenEl) {
      myTokenEl.textContent = `#${String(myAppt.serial_number).padStart(2, '0')}`;
    }

    if (myAppt.status === 'in_chamber') {
      if (estWaitEl) estWaitEl.textContent = '0 min (Inside)';
      if (queueStatusNotice) {
        queueStatusNotice.innerHTML = `
          <div class="p-4 bg-green-50 border border-green-300 rounded-lg text-green-900 font-medium flex items-center gap-3">
            <span class="inline-block w-3 h-3 rounded-full bg-green-600 animate-pulse"></span>
            It is your turn! Please step into the doctor's consultation room.
          </div>
        `;
      }
    } else {
      const wait = myAppt.predicted_eta_mins !== undefined ? myAppt.predicted_eta_mins : 15;
      if (estWaitEl) estWaitEl.textContent = `~${wait} mins`;

      if (queueStatusNotice) {
        queueStatusNotice.innerHTML = `
          <div class="text-slate-600 text-sm">
            Visit Type: <span class="font-semibold text-slate-800">${myAppt.visit_type}</span>
            ${myAppt.is_emergency ? '<span class="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-800 border border-red-300">EMERGENCY PRIORITY</span>' : ''}
          </div>
        `;
      }

      // Check client-side commute alerts
      if (wait <= 10) {
        displayCommuteAlert({
          type: '10_MIN_ALERT',
          etaMins: wait,
          en: `Your turn is in ~${wait} mins. Please enter the waiting area now.`,
          bn: `আপনার সিরিয়াল প্রায় ~${wait} মিনিটের মধ্যে। অনুগ্রহ করে এখন ওয়েটিং এরিয়ায় প্রবেশ করুন।`
        });
      } else if (wait <= 45) {
        displayCommuteAlert({
          type: '45_MIN_ALERT',
          etaMins: wait,
          en: `Your turn is in ~${wait} mins. Please start heading to the clinic.`,
          bn: `আপনার সিরিয়াল প্রায় ~${wait} মিনিটের মধ্যে। অনুগ্রহ করে ক্লিনিকের উদ্দেশ্যে রওনা দিন।`
        });
      }
    }
  } else {
    // Patient has no active token, show booking box
    if (activeTokenCard) activeTokenCard.classList.add('hidden');
    if (bookingBox) bookingBox.classList.remove('hidden');
    if (myTokenEl) myTokenEl.textContent = '--';
    if (estWaitEl) estWaitEl.textContent = '--';
  }
}

function displayCommuteAlert(alert) {
  const alertBox = document.getElementById('stagedAlertBanner');
  if (!alertBox) return;

  const is10 = alert.type === '10_MIN_ALERT' || (alert.etaMins && alert.etaMins <= 10);
  const colorClass = is10
    ? 'bg-amber-100 border-amber-300 text-amber-900'
    : 'bg-blue-100 border-blue-300 text-blue-900';

  const heading = is10
    ? (currentLang === 'bn' ? 'অনুগ্রহ করে এখন ওয়েটিং এরিয়ায় আসুন' : 'Please Step into Waiting Area')
    : (currentLang === 'bn' ? 'ক্লিনিকের উদ্দেশ্যে রওনা হওয়ার সময় হয়েছে' : 'Time to Depart for Clinic');

  const text = (currentLang === 'bn' && alert.bn) ? alert.bn : (alert.en || alert.message || 'Approaching your appointment time.');

  alertBox.className = `p-4 mb-6 rounded-lg border flex items-start gap-4 shadow-sm transition-all duration-300 ${colorClass}`;
  alertBox.innerHTML = `
    <div class="p-2 bg-white rounded-full shadow-sm text-xl font-bold flex-shrink-0">
      ${is10 ? '🔔' : '🚗'}
    </div>
    <div class="flex-grow">
      <h3 class="font-bold text-base md:text-lg">${heading}</h3>
      <p class="text-sm md:text-base mt-1">${text}</p>
    </div>
    <button onclick="document.getElementById('stagedAlertBanner').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 text-lg font-bold px-2 py-1">
      ✕
    </button>
  `;
  alertBox.classList.remove('hidden');
}

async function handleBookToken(e) {
  e.preventDefault();
  const visitType = document.getElementById('visitTypeSelect').value;
  const isEmergency = document.getElementById('isEmergencyCheckbox')?.checked || false;

  const btn = document.getElementById('btnBookToken');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/queue/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: currentUser.id,
        visit_type: visitType,
        is_emergency: isEmergency
      })
    });
    const data = await res.json();
    if (data.success) {
      currentAppointment = data.appointment;
      await refreshPatientData();
    } else {
      alert(data.error || 'Failed to book token');
    }
  } catch (err) {
    alert('Booking error: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleUploadReport(e) {
  e.preventDefault();
  const fileInput = document.getElementById('reportFileInput');
  const titleInput = document.getElementById('reportTitleInput');
  const resultCard = document.getElementById('extractedReportResults');
  const loadingNotice = document.getElementById('ocrLoadingNotice');
  const btn = document.getElementById('btnSubmitReport');

  const formData = new FormData();
  formData.append('patient_id', currentUser.id);
  formData.append('report_title', titleInput.value || 'Lab Investigation');
  if (fileInput.files.length > 0) {
    formData.append('report_file', fileInput.files[0]);
  }

  if (loadingNotice) loadingNotice.classList.remove('hidden');
  if (resultCard) resultCard.classList.add('hidden');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/reports/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (loadingNotice) loadingNotice.classList.add('hidden');

    if (data.success && data.ocr_data) {
      renderExtractedBiomarkers(data.ocr_data.extracted_biomarkers, data.ocr_data.ai_summary);
      if (resultCard) resultCard.classList.remove('hidden');
      await loadPastRecords();
    } else {
      alert(data.error || 'Failed to process report');
    }
  } catch (err) {
    if (loadingNotice) loadingNotice.classList.add('hidden');
    alert('Upload error: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderExtractedBiomarkers(biomarkers, summary) {
  const tableBody = document.getElementById('biomarkersTableBody');
  const summaryBox = document.getElementById('aiSummaryBox');

  if (summaryBox) {
    summaryBox.textContent = summary || 'Report scanned and normalized successfully.';
  }

  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!biomarkers || biomarkers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500">No test biomarkers parsed.</td></tr>`;
    return;
  }

  biomarkers.forEach(b => {
    let badgeClass = 'bg-green-100 text-green-800 border-green-300';
    if (b.status === 'HIGH' || b.status === 'LOW') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (b.status === 'CRITICAL') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
    }

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-200 hover:bg-slate-50';
    tr.innerHTML = `
      <td class="p-3 font-semibold text-slate-900">${b.test_name}</td>
      <td class="p-3 text-slate-800 font-mono font-medium">${b.value} ${b.unit}</td>
      <td class="p-3 text-slate-600 text-sm">${b.ref_range || 'Normal'}</td>
      <td class="p-3">
        <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${badgeClass}">
          ${b.status}
        </span>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadPastRecords() {
  const listEl = document.getElementById('pastRecordsList');
  if (!listEl) return;

  try {
    const res = await fetch(`/api/reports/patient/${currentUser.id}`);
    const data = await res.json();

    if (data.success && data.records && data.records.length > 0) {
      listEl.innerHTML = '';
      data.records.forEach(r => {
        const item = document.createElement('div');
        item.className = 'p-4 bg-white border border-slate-200 rounded-lg shadow-sm';
        item.innerHTML = `
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-bold text-slate-900 text-base">${r.report_title}</h4>
              <p class="text-xs text-slate-500">Date: ${r.report_date}</p>
            </div>
            <span class="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-300">
              Digitized
            </span>
          </div>
          <p class="text-sm text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">${r.ai_summary || 'Standard lab findings.'}</p>
        `;
        listEl.appendChild(item);
      });
    } else {
      listEl.innerHTML = `<p class="text-slate-500 text-sm italic" data-i18n="no_records_yet">No digitized reports uploaded yet.</p>`;
    }
  } catch (err) {
    console.error('Error loading past records:', err);
  }
}
