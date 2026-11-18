const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { processReportFile } = require('../reportProcessor');

// Configure upload directory
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `report_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/reports/upload: Upload image/PDF and extract biomarkers via AI OCR
router.post('/upload', upload.single('report_file'), async (req, res) => {
  try {
    const { patient_id, report_title } = req.body;
    if (!patient_id) {
      return res.status(400).json({ success: false, error: 'patient_id is required' });
    }

    let filePath = '';
    let fileName = 'Sample Diagnostic Report';
    if (req.file) {
      filePath = req.file.path;
      fileName = req.file.originalname;
    } else {
      // In case user submits simulated text
      filePath = path.join(uploadDir, `report_sim_${Date.now()}.txt`);
      fs.writeFileSync(filePath, 'Simulated Lab Report for Patient ' + patient_id, 'utf8');
    }

    // Run AI OCR extractor
    const ocrResult = await processReportFile(filePath);

    // Save record to database
    const record = await db.createMedicalRecord({
      patient_id: Number(patient_id),
      report_title: report_title || fileName,
      report_date: new Date().toISOString().split('T')[0],
      file_path: filePath,
      extracted_biomarkers: ocrResult.extracted_biomarkers || [],
      ai_summary: ocrResult.ai_summary || 'Standard lab panel processed.'
    });

    res.json({
      success: true,
      message: 'Report processed and digitized successfully',
      record,
      ocr_data: ocrResult
    });
  } catch (err) {
    console.error('[Report Upload Error]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/patient/:patientId: Get patient's digitized medical records
router.get('/patient/:patientId', async (req, res) => {
  try {
    const records = await db.getMedicalRecordsByPatient(req.params.patientId);
    res.json({
      success: true,
      records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
