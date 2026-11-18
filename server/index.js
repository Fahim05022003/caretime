require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { initPredictor } = require('./etaPredictor');

const authRoutes = require('./routes/auth');
const createQueueRoutes = require('./routes/queue');
const reportsRoutes = require('./routes/reports');
const doctorRoutes = require('./routes/doctor');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
const publicDir = path.join(__dirname, '..', 'public');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// Socket.io real-time connection management
io.on('connection', (socket) => {
  // Client can register their role and patient id for targeted notifications
  socket.on('register', (data) => {
    if (data && data.patientId) {
      socket.join(`patient_${data.patientId}`);
    }
    if (data && data.role) {
      socket.join(`role_${data.role}`);
    }
  });

  socket.on('disconnect', () => {
    // Clean disconnection
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/queue', createQueueRoutes(io));
app.use('/api/reports', reportsRoutes);
app.use('/api/doctor', doctorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    postgres_active: db.isUsingPg()
  });
});

// Direct page navigation fallbacks
app.get('/', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/patient', (req, res) => res.sendFile(path.join(publicDir, 'patient.html')));
app.get('/assistant', (req, res) => res.sendFile(path.join(publicDir, 'assistant.html')));
app.get('/doctor', (req, res) => res.sendFile(path.join(publicDir, 'doctor.html')));

// Initialize services and start server
async function startServer() {
  try {
    await db.initDb();
    await initPredictor();

    server.listen(PORT, '0.0.0.0', () => {
      console.log('====================================================');
      console.log(` CareTime Web Application running at http://0.0.0.0:${PORT}`);
      console.log(` - Patient Portal:   http://localhost:${PORT}/patient.html`);
      console.log(` - Assistant Console: http://localhost:${PORT}/assistant.html`);
      console.log(` - Doctor Cockpit:   http://localhost:${PORT}/doctor.html`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('Failed to start CareTime server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
