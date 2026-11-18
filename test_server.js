const http = require('http');
const db = require('./server/db');
const { initPredictor } = require('./server/etaPredictor');
const { app, server } = require('./server/index');

const TEST_PORT = 3100;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }

    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING CARETIME FULL-STACK TEST SUITE ---');

  // Ensure DB and Predictor are initialized
  await db.initDb();
  await initPredictor();

  // Start server on test port
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[Test Server] Listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // 1. Health Check
    const health = await request('/api/health');
    console.log('✓ Health check status:', health.status, '| DB using Postgres:', health.body.postgres_active);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Active Queue
    const queue = await request('/api/queue/active');
    console.log('✓ Active Queue Session Token:', queue.body.session.current_serving_token, '| Waiting Count:', queue.body.waiting_list.length);
    if (queue.status !== 200) throw new Error('Active queue check failed');

    // 3. Demo Login
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { demoRole: 'patient' }
    });
    console.log('✓ Demo Patient Login:', login.body.user.full_name, '| PHID:', login.body.user.phid);
    if (login.status !== 200 || !login.body.user) throw new Error('Demo login failed');

    // 4. Doctor Patient Clinical Brief
    const docPatient = await request('/api/doctor/patient/CT-2026-8492');
    console.log('✓ 3-Line Clinical Brief:');
    console.log('   Line 1:', docPatient.body.ai_brief.line1);
    console.log('   Line 2:', docPatient.body.ai_brief.line2);
    console.log('   Line 3:', docPatient.body.ai_brief.line3);
    console.log('   Longitudinal Trend Dates:', docPatient.body.trendData.dates);
    if (docPatient.status !== 200) throw new Error('Doctor patient brief failed');

    // 5. Allergy Guardrail Test
    const allergyTest = await request('/api/doctor/prescribe', {
      method: 'POST',
      body: {
        patient_id: docPatient.body.patient.id,
        medicines: [{ name: 'Amoxicillin 500mg', dosage: '1+0+1', duration: '7 days' }],
        diagnosis: 'Bacterial Pharyngitis',
        force_confirm: false
      }
    });
    console.log('✓ Allergy Safety Guardrail Response Code:', allergyTest.status, '| Warning:', allergyTest.body.warning);
    if (allergyTest.status !== 409 || allergyTest.body.warning !== 'ALLERGY_CONFLICT_DETECTED') {
      throw new Error('Allergy safety check should have returned 409 ALLERGY_CONFLICT_DETECTED');
    }
    console.log('   Conflict correctly caught:', allergyTest.body.message);

    // 6. Prescribe with Force Confirm Override
    const rxSuccess = await request('/api/doctor/prescribe', {
      method: 'POST',
      body: {
        patient_id: docPatient.body.patient.id,
        medicines: [{ name: 'Azithromycin 500mg', dosage: '1+0+0', duration: '5 days' }],
        diagnosis: 'Respiratory Infection (Penicillin Alternative)',
        advice: 'Drink warm water and rest.',
        force_confirm: true
      }
    });
    console.log('✓ Prescribe Success:', rxSuccess.status, '| Message:', rxSuccess.body.message);
    if (rxSuccess.status !== 200) throw new Error('Prescription override failed');

    // 7. Assistant Queue Action: Call Next Patient
    const callNext = await request('/api/queue/action', {
      method: 'POST',
      body: { action: 'call_next' }
    });
    console.log('✓ Assistant Action (call_next): Token is now #', callNext.body.queueState.session.current_serving_token);

    // 8. Assistant Action: Add Doctor Delay
    const addDelay = await request('/api/queue/action', {
      method: 'POST',
      body: { action: 'set_delay', delay_mins: 15 }
    });
    console.log('✓ Assistant Action (set_delay): Doctor delay is now', addDelay.body.queueState.session.doctor_delay_mins, 'mins');

    // 9. Static UI Pages
    const p1 = await request('/');
    const p2 = await request('/patient.html');
    const p3 = await request('/assistant.html');
    const p4 = await request('/doctor.html');
    console.log(`✓ Frontend UI Pages Status: Home=${p1.status}, Patient=${p2.status}, Assistant=${p3.status}, Doctor=${p4.status}`);
    if (p1.status !== 200 || p2.status !== 200 || p3.status !== 200 || p4.status !== 200) {
      throw new Error('Static UI pages check failed');
    }

    console.log('====================================================');
    console.log('ALL 9 CARETIME INTEGRATION TESTS PASSED PERFECTLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      console.log('[Test Server] Closed cleanly.');
      process.exit(process.exitCode || 0);
    });
  }
}

runTests();
