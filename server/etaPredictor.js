const fs = require('fs');
const path = require('path');

let ort = null;
let onnxSession = null;
let useOnnx = false;

const ONNX_MODEL_PATH = path.join(__dirname, '..', 'ai_engine', 'models', 'eta_model.onnx');

// Visit complexity weights specified in requirements
const VISIT_WEIGHTS = {
  'New Checkup': 1.4,
  'Follow-up': 1.0,
  'Report Show': 0.5
};

async function initPredictor() {
  try {
    ort = require('onnxruntime-node');
    if (fs.existsSync(ONNX_MODEL_PATH)) {
      onnxSession = await ort.InferenceSession.create(ONNX_MODEL_PATH);
      useOnnx = true;
      console.log('[ETA Predictor] Loaded ONNX model from:', ONNX_MODEL_PATH);
    } else {
      console.log('[ETA Predictor] ONNX model not yet found. Using deterministic mathematical clinical model.');
    }
  } catch (err) {
    console.warn('[ETA Predictor] ONNX Runtime initialization note (' + err.message + '). Active fallback: deterministic clinical formula.');
    useOnnx = false;
  }
}

/**
 * Deterministic regression model matching the LightGBM trained formula
 */
function calculateDeterministicETA({
  patientsAhead,
  doctorBaselineMins = 10.0,
  trailingPaceMins = 10.0,
  weightedVisitUnits = 0.0,
  doctorDelayMins = 0
}) {
  if (patientsAhead <= 0) {
    return Math.max(0, Math.round(doctorDelayMins));
  }

  // 40% historical baseline + 60% dynamic rolling pace
  const effectivePace = (0.4 * doctorBaselineMins) + (0.6 * trailingPaceMins);
  const estimatedWait = (weightedVisitUnits * effectivePace) + doctorDelayMins;
  return Math.max(1, Math.round(estimatedWait));
}

/**
 * Predict ETA for a single patient
 */
async function predictWaitTime({
  patientsAhead,
  doctorBaselineMins = 10.0,
  trailingPaceMins = 10.0,
  weightedVisitUnits = 0.0,
  doctorDelayMins = 0
}) {
  if (useOnnx && onnxSession && ort) {
    try {
      const inputData = Float32Array.from([
        Number(patientsAhead),
        Number(doctorBaselineMins),
        Number(trailingPaceMins),
        Number(weightedVisitUnits),
        Number(doctorDelayMins)
      ]);
      const tensor = new ort.Tensor('float32', inputData, [1, 5]);
      const feeds = {};
      const inputName = onnxSession.inputNames[0] || 'float_input';
      feeds[inputName] = tensor;
      const results = await onnxSession.run(feeds);
      const outputName = onnxSession.outputNames[0] || 'variable';
      const outputTensor = results[outputName];
      const rawVal = outputTensor.data[0];
      return Math.max(0, Math.round(rawVal));
    } catch (err) {
      // Fallback on inference error
      return calculateDeterministicETA({
        patientsAhead,
        doctorBaselineMins,
        trailingPaceMins,
        weightedVisitUnits,
        doctorDelayMins
      });
    }
  }

  return calculateDeterministicETA({
    patientsAhead,
    doctorBaselineMins,
    trailingPaceMins,
    weightedVisitUnits,
    doctorDelayMins
  });
}

/**
 * Recalculate ETAs for all appointments in an active queue session
 * Returns updated appointments and any triggered commute alerts
 */
async function recalculateQueueETAs(session, appointments) {
  const doctorBaseline = session.avg_consult_mins || 10.0;
  const doctorDelay = session.doctor_delay_mins || 0;

  // Calculate trailing 3 completed patients pace
  const completed = appointments
    .filter(a => a.status === 'completed' && a.started_at && a.completed_at)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
    .slice(0, 3);

  let trailingPace = doctorBaseline;
  if (completed.length > 0) {
    const totalDurationMins = completed.reduce((acc, curr) => {
      const diffMs = new Date(curr.completed_at) - new Date(curr.started_at);
      const mins = Math.max(2, Math.round(diffMs / 60000));
      return acc + mins;
    }, 0);
    trailingPace = totalDurationMins / completed.length;
  }

  // Find in-chamber patient if any
  const inChamber = appointments.find(a => a.status === 'in_chamber');

  // Waiting list ordered by emergency first, then serial_number
  const waitingList = appointments.filter(a => a.status === 'waiting');

  let accumulatedWeights = inChamber ? (VISIT_WEIGHTS[inChamber.visit_type] || 1.0) * 0.5 : 0;
  const updatedAppointments = [];
  const triggeredAlerts = [];

  for (let i = 0; i < waitingList.length; i++) {
    const appt = waitingList[i];
    const patientsAhead = i + (inChamber ? 1 : 0);

    const etaMins = await predictWaitTime({
      patientsAhead,
      doctorBaselineMins: doctorBaseline,
      trailingPaceMins: trailingPace,
      weightedVisitUnits: accumulatedWeights,
      doctorDelayMins: doctorDelay
    });

    accumulatedWeights += (VISIT_WEIGHTS[appt.visit_type] || 1.0);

    // Staged commute alerts logic
    let alert45 = appt.alert_45_sent;
    let alert10 = appt.alert_10_sent;
    let alertMessage = null;

    if (etaMins <= 10 && !alert10) {
      alert10 = true;
      alertMessage = {
        type: '10_MIN_ALERT',
        patientId: appt.patient_id,
        appointmentId: appt.id,
        serialNumber: appt.serial_number,
        etaMins,
        en: `Your turn is in ~${etaMins} mins. Please enter the waiting area now.`,
        bn: `আপনার সিরিয়াল প্রায় ~${etaMins} মিনিটের মধ্যে। অনুগ্রহ করে এখন ওয়েটিং এরিয়ায় প্রবেশ করুন।`
      };
    } else if (etaMins <= 45 && !alert45) {
      alert45 = true;
      alertMessage = {
        type: '45_MIN_ALERT',
        patientId: appt.patient_id,
        appointmentId: appt.id,
        serialNumber: appt.serial_number,
        etaMins,
        en: `Your turn is in ~${etaMins} mins. Please start heading to the clinic.`,
        bn: `আপনার সিরিয়াল প্রায় ~${etaMins} মিনিটের মধ্যে। অনুগ্রহ করে ক্লিনিকের উদ্দেশ্যে রওনা দিন।`
      };
    }

    if (alertMessage) {
      triggeredAlerts.push(alertMessage);
    }

    updatedAppointments.push({
      ...appt,
      predicted_eta_mins: etaMins,
      alert_45_sent: alert45,
      alert_10_sent: alert10
    });
  }

  return {
    updatedAppointments,
    triggeredAlerts,
    trailingPace: Math.round(trailingPace * 10) / 10
  };
}

module.exports = {
  initPredictor,
  predictWaitTime,
  recalculateQueueETAs,
  VISIT_WEIGHTS
};
