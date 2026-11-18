const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to generate unique PHID format: CT-2026-XXXX
function generatePHID() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CT-2026-${randomDigits}`;
}

// Quick Demo Login & Standard Phone + OTP Login
router.post('/login', async (req, res) => {
  try {
    const { phone, otp, role, demoRole, full_name, allergies, chronic_conditions } = req.body;

    // 1. One-Click Demo Login support
    if (demoRole) {
      const demoUsers = await db.getUsersByRole(demoRole);
      if (demoUsers && demoUsers.length > 0) {
        return res.json({
          success: true,
          message: `Logged in as demo ${demoRole}`,
          user: demoUsers[0]
        });
      }
    }

    // 2. Phone + OTP login
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    // In dev mode, accept any 4-digit OTP
    if (!otp || String(otp).length < 4) {
      return res.status(400).json({ success: false, error: 'Valid 4-digit OTP required (e.g., 1234 in dev mode).' });
    }

    let user = await db.findUserByPhone(phone);

    // If new user, register them
    if (!user) {
      const userRole = role || 'patient';
      const phid = generatePHID();
      user = await db.createUser({
        phid,
        full_name: full_name || `Patient ${phone.slice(-4)}`,
        phone,
        role: userRole,
        allergies: allergies || 'None',
        chronic_conditions: chronic_conditions || 'None'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      user
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Demo accounts listing for instant test bar
router.get('/demo-accounts', async (req, res) => {
  try {
    const doctors = await db.getUsersByRole('doctor');
    const assistants = await db.getUsersByRole('assistant');
    const patients = await db.getUsersByRole('patient');

    res.json({
      success: true,
      doctor: doctors[0] || null,
      assistant: assistants[0] || null,
      patient: patients[0] || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
