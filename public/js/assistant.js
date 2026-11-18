// Clinic Assistant Operations Console JavaScript
let socket = null;
let currentSession = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSocket();
  await loadQueueState();

  // Control Buttons
  const btnCallNext = document.getElementById('btnCallNext');
  const btnComplete = document.getElementById('btnCompleteCurrent');
  const btnAddDelay = document.getElementById('btnAddDelay');

  if (btnCallNext) {
    btnCallNext.addEventListener('click', () => triggerQueueAction('call_next'));
  }
  if (btnComplete) {
    btnComplete.addEventListener('click', () => triggerQueueAction('complete_current'));
  }
  if (btnAddDelay) {
    btnAddDelay.addEventListener('click', () => triggerQueueAction('set_delay', { delay_mins: 15 }));
  }
});

function initSocket() {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.emit('register', { role: 'assistant' });

    socket.on('queue:updated', (data) => {
      renderQueueState(data);
    });
  }
}

async function loadQueueState() {
  try {
    const res = await fetch('/api/queue/active');
    const data = await res.json();
    if (data.success) {
      renderQueueState(data);
    }
  } catch (err) {
    console.error('Failed to load active queue:', err);
  }
}

async function triggerQueueAction(action, payload = {}) {
  try {
    const res = await fetch('/api/queue/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Action could not be completed.');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

function renderQueueState(data) {
  currentSession = data.session;

  // Render Top Status Strip
  const currentTokenEl = document.getElementById('assistantCurrentToken');
  const paceEl = document.getElementById('assistantPaceDisplay');
  const delayEl = document.getElementById('assistantDelayDisplay');
  const inChamberCard = document.getElementById('assistantInChamberCard');

  if (currentTokenEl) {
    currentTokenEl.textContent = `#${String(data.session.current_serving_token || 0).padStart(2, '0')}`;
  }
  if (paceEl) {
    paceEl.textContent = `${data.session.trailing_pace_mins || data.session.avg_consult_mins || 10.0} mins/pt`;
  }
  if (delayEl) {
    delayEl.textContent = `${data.session.doctor_delay_mins || 0} mins`;
  }

  // Render In-Chamber Patient Banner
  if (inChamberCard) {
    if (data.in_chamber) {
      const p = data.in_chamber;
      inChamberCard.innerHTML = `
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <span class="inline-block px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white uppercase tracking-wider mb-1">Inside Chamber</span>
            <h3 class="text-xl font-bold text-slate-900">Token #${String(p.serial_number).padStart(2, '0')}: ${p.patient_name || 'Patient'}</h3>
            <p class="text-sm text-slate-600">PHID: <span class="font-mono font-medium">${p.phid || 'N/A'}</span> | Type: ${p.visit_type} | Phone: ${p.patient_phone || 'N/A'}</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-500 block">Consultation started</span>
            <span class="text-sm font-semibold text-slate-800">${p.started_at ? new Date(p.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
          </div>
        </div>
      `;
    } else {
      inChamberCard.innerHTML = `
        <div class="p-4 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-center font-medium">
          Chamber is currently empty. Tap <strong class="text-blue-600 font-bold">CALL NEXT PATIENT</strong> to admit the next patient.
        </div>
      `;
    }
  }

  // Render Waiting List Table
  const tableBody = document.getElementById('waitingQueueTableBody');
  const emptyNotice = document.getElementById('emptyQueueNotice');

  if (!tableBody) return;
  tableBody.innerHTML = '';

  const waitingList = data.waiting_list || [];
  if (waitingList.length === 0) {
    if (emptyNotice) emptyNotice.classList.remove('hidden');
    return;
  }
  if (emptyNotice) emptyNotice.classList.add('hidden');

  waitingList.forEach((appt, index) => {
    const isEmerg = appt.is_emergency;
    const tr = document.createElement('tr');
    tr.className = `border-b border-slate-200 transition-colors ${isEmerg ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50'}`;

    tr.innerHTML = `
      <td class="p-3 font-mono font-bold text-lg text-slate-900">
        #${String(appt.serial_number).padStart(2, '0')}
      </td>
      <td class="p-3">
        <div class="font-bold text-slate-900 text-base">${appt.patient_name}</div>
        <div class="text-xs text-slate-500 font-mono">${appt.phid || ''} | ${appt.patient_phone || ''}</div>
      </td>
      <td class="p-3">
        <span class="inline-block px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-800 border border-slate-200">
          ${appt.visit_type}
        </span>
        ${isEmerg ? '<span class="ml-1 inline-block px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-800 border border-red-300">EMERGENCY</span>' : ''}
      </td>
      <td class="p-3 font-semibold text-slate-800">
        ~${appt.predicted_eta_mins} mins
      </td>
      <td class="p-3">
        ${!isEmerg ? `
          <button onclick="bumpEmergency(${appt.id})" class="min-h-[40px] px-3 py-1.5 text-xs font-bold rounded bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 transition-colors">
            <span>🚨</span> EMERGENCY BUMP
          </button>
        ` : `
          <span class="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-200">Highest Priority</span>
        `}
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function bumpEmergency(appointmentId) {
  if (confirm('Move this patient to the top of the waiting queue immediately?')) {
    triggerQueueAction('emergency_bump', { appointment_id: appointmentId });
  }
}
