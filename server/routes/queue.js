const express = require('express');
const router = express.Router();
const db = require('../db');
const { recalculateQueueETAs } = require('../etaPredictor');

module.exports = function (io) {
  // Helper to sync ETAs and emit alerts
  async function syncAndBroadcastQueue(session) {
    if (!session) return null;

    let appts = await db.getAppointmentsBySession(session.id);
    const { updatedAppointments, triggeredAlerts, trailingPace } = await recalculateQueueETAs(session, appts);

    // Save recalculated ETAs and alert flags
    for (const item of updatedAppointments) {
      await db.updateAppointment(item.id, {
        predicted_eta_mins: item.predicted_eta_mins,
        alert_45_sent: item.alert_45_sent,
        alert_10_sent: item.alert_10_sent
      });
    }

    // Refresh final list
    const finalAppts = await db.getAppointmentsBySession(session.id);
    const inChamber = finalAppts.find(a => a.status === 'in_chamber') || null;

    const payload = {
      session: {
        ...session,
        current_serving_token: inChamber ? inChamber.serial_number : session.current_serving_token,
        trailing_pace_mins: trailingPace
      },
      in_chamber: inChamber,
      waiting_list: finalAppts.filter(a => a.status === 'waiting'),
      completed_list: finalAppts.filter(a => a.status === 'completed'),
      total_waiting: finalAppts.filter(a => a.status === 'waiting').length
    };

    // Emit live queue update to all connected clients
    if (io) {
      io.emit('queue:updated', payload);

      // Emit triggered commute alerts
      for (const alert of triggeredAlerts) {
        io.emit(`patient:alert:${alert.patientId}`, alert);
        io.emit('patient:alert', alert);
      }
    }

    return payload;
  }

  // GET /api/queue/active: Active doctor session, current serving token, waiting list & ETAs
  router.get('/active', async (req, res) => {
    try {
      let session = await db.getActiveQueueSession();
      if (!session) {
        // Create a default session if none exists
        const doctors = await db.getUsersByRole('doctor');
        const doctorId = doctors.length > 0 ? doctors[0].id : 1;
        session = await db.createQueueSession({
          doctor_id: doctorId,
          current_serving_token: 0,
          doctor_delay_mins: 0,
          avg_consult_mins: 10.0,
          status: 'active'
        });
      }

      const queueState = await syncAndBroadcastQueue(session);
      res.json({ success: true, ...queueState });
    } catch (err) {
      console.error('[Queue Active Error]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/queue/patient/:patientId: Status for a specific patient
  router.get('/patient/:patientId', async (req, res) => {
    try {
      const activeAppt = await db.getActiveAppointmentForPatient(req.params.patientId);
      const session = await db.getActiveQueueSession();
      let nowServing = session ? session.current_serving_token : 0;
      let inChamber = null;

      if (session) {
        const appts = await db.getAppointmentsBySession(session.id);
        inChamber = appts.find(a => a.status === 'in_chamber') || null;
        if (inChamber) {
          nowServing = inChamber.serial_number;
        }
      }

      res.json({
        success: true,
        appointment: activeAppt,
        now_serving: nowServing,
        in_chamber: inChamber,
        doctor_delay_mins: session ? session.doctor_delay_mins : 0
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/queue/book: Book a new serial token
  router.post('/book', async (req, res) => {
    try {
      const { patient_id, visit_type = 'New Checkup', is_emergency = false } = req.body;

      if (!patient_id) {
        return res.status(400).json({ success: false, error: 'patient_id is required' });
      }

      let session = await db.getActiveQueueSession();
      if (!session) {
        const doctors = await db.getUsersByRole('doctor');
        session = await db.createQueueSession({
          doctor_id: doctors[0] ? doctors[0].id : 1,
          current_serving_token: 0,
          doctor_delay_mins: 0,
          avg_consult_mins: 10.0,
          status: 'active'
        });
      }

      // Check if patient already has an active appointment in this session
      const existing = await db.getActiveAppointmentForPatient(patient_id);
      if (existing) {
        return res.json({
          success: true,
          message: 'Patient already has an active serial token',
          appointment: existing
        });
      }

      // Determine next serial number
      const allAppts = await db.getAppointmentsBySession(session.id);
      const nextSerial = allAppts.length > 0 ? Math.max(...allAppts.map(a => a.serial_number)) + 1 : 1;

      const newAppt = await db.createAppointment({
        session_id: session.id,
        patient_id: Number(patient_id),
        serial_number: nextSerial,
        visit_type,
        is_emergency: !!is_emergency,
        predicted_eta_mins: 15,
        status: 'waiting'
      });

      // Recalculate ETAs and broadcast
      const queueState = await syncAndBroadcastQueue(session);

      res.json({
        success: true,
        message: 'Serial booked successfully',
        appointment: newAppt,
        queueState
      });
    } catch (err) {
      console.error('[Queue Book Error]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/queue/action: Assistant actions (call_next, complete_current, emergency_bump, set_delay)
  router.post('/action', async (req, res) => {
    try {
      const { action, appointment_id, delay_mins } = req.body;
      const session = await db.getActiveQueueSession();
      if (!session) {
        return res.status(404).json({ success: false, error: 'No active session found.' });
      }

      const allAppts = await db.getAppointmentsBySession(session.id);
      const inChamber = allAppts.find(a => a.status === 'in_chamber');

      if (action === 'call_next') {
        // If someone is currently in chamber, complete or mark them first
        if (inChamber) {
          await db.updateAppointment(inChamber.id, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
        }

        // Find next waiting patient (emergency first, then lowest serial_number)
        const waitingList = allAppts
          .filter(a => a.status === 'waiting')
          .sort((a, b) => {
            if (a.is_emergency !== b.is_emergency) return b.is_emergency ? 1 : -1;
            return a.serial_number - b.serial_number;
          });

        if (waitingList.length === 0) {
          return res.status(400).json({ success: false, error: 'No waiting patients in the queue.' });
        }

        const nextPatient = waitingList[0];
        await db.updateAppointment(nextPatient.id, {
          status: 'in_chamber',
          started_at: new Date().toISOString(),
          predicted_eta_mins: 0
        });

        await db.updateQueueSession(session.id, {
          current_serving_token: nextPatient.serial_number
        });
      } else if (action === 'complete_current') {
        if (!inChamber) {
          return res.status(400).json({ success: false, error: 'No patient currently inside chamber.' });
        }

        const now = new Date();
        const started = inChamber.started_at ? new Date(inChamber.started_at) : now;
        const consultDurationMins = Math.max(2, Math.round((now - started) / 60000));

        await db.updateAppointment(inChamber.id, {
          status: 'completed',
          completed_at: now.toISOString()
        });

        // Update doctor's rolling average consult mins
        const completedAppts = allAppts
          .filter(a => a.status === 'completed' && a.started_at && a.completed_at)
          .slice(-3);
        const durations = [...completedAppts.map(a => Math.max(2, Math.round((new Date(a.completed_at) - new Date(a.started_at)) / 60000))), consultDurationMins];
        const newAvg = durations.reduce((a, b) => a + b, 0) / durations.length;

        await db.updateQueueSession(session.id, {
          avg_consult_mins: Math.round(newAvg * 10) / 10
        });
      } else if (action === 'emergency_bump') {
        if (!appointment_id) {
          return res.status(400).json({ success: false, error: 'appointment_id is required for emergency bump' });
        }
        await db.updateAppointment(appointment_id, {
          is_emergency: true
        });
      } else if (action === 'set_delay') {
        const addMins = Number(delay_mins) || 15;
        const newTotalDelay = (session.doctor_delay_mins || 0) + addMins;
        await db.updateQueueSession(session.id, {
          doctor_delay_mins: newTotalDelay
        });
        session.doctor_delay_mins = newTotalDelay;
      } else {
        return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
      }

      const updatedSession = await db.getActiveQueueSession();
      const queueState = await syncAndBroadcastQueue(updatedSession);

      res.json({
        success: true,
        action,
        queueState
      });
    } catch (err) {
      console.error('[Queue Action Error]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};
