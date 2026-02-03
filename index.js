const express = require('express');
//const router = express.Router();
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const db = require('./db');
const util = require('util');

const queryAsync = util.promisify(db.query).bind(db);
const app = express();
const PORT = 3001;
const cors=require('cors');

//const { use } = require('react');
// Middleware
app.use(cors({
  origin: true, // Change if using Live Server
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
// Serve all static files in public
app.use(express.static(path.join(__dirname, 'public')));
// Middleware to check if user is logged in


app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
   cookie: { secure: false }
}));

// ========== Register Route ==========
app.post('/register', (req, res) => {
  const { user_id, name, email, password, role, phone, gender, dob, address } = req.body;
  if (!user_id || !name || !email || !password || !role || !phone || !gender || !dob || !address) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  const sql = 'INSERT INTO users (user_id, name, email, password, role, phone, gender, dob, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [user_id, name, email, password, role, phone, gender, dob, address], (err) => {
    if (err) {
      console.error('Register error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Email already exists.' });
      }
      return res.status(500).json({ message: 'Registration failed.' });
    }
    res.json({ message: 'Registration successful' });
  });
});

// ========== Login Route ==========
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(sql, [email, password], (err, result) => {
    if (err) return res.status(500).json({ message: 'Login error' });
    if (result.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

    const user = result[0];
    req.session.user = {
      id: user.user_id,
      email: user.email,
      role: user.role,
      name:user.name
    };

    let redirectUrl = '/';
    switch (user.role) {
      case 'doctor': redirectUrl = '/doctor-dashboard.html'; break;
      case 'patient': redirectUrl = '/patient-dashboard.html'; break;
      case 'admin': redirectUrl = '/admin-dashboard.html'; break;
      case 'receptionist': redirectUrl = '/receptionist-dashboard.html'; break;
      case 'pharmacist': redirectUrl = '/pharmacist-dashboard.html'; break;
       case 'staff': redirectUrl = '/staff-dashboard.html'; break;
    }
        res.json({ user, redirect: redirectUrl });
  });
});

// ========== Password Reset ==========
app.post('/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  const sql = 'UPDATE users SET password = ? WHERE email = ?';
  db.query(sql, [newPassword, email], (err, result) => {
    if (err) return res.status(500).send('❌ Error resetting password');
    if (result.affectedRows === 0) return res.send('❌ Email not found');
    res.send('✅ Password reset successfully');
  });
});

// ========== Logout ==========
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Could not log out.');
    res.redirect('/login.html');
  });
});


// Middleware for doctor-only routes
function requireDoctor(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'doctor') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

// Multer setup for profile picture uploads
//const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doctor_${req.session.user.id}${ext}`);
  }
});
const upload = multer({ storage });

// GET doctor profile
app.get('/doctor/profile', requireDoctor, (req, res) => {
  const doctorId = req.session.user.id;
  const sql = `
    SELECT u.name, u.email, u.phone, u.gender, u.dob, u.address,
           d.specialization, d.qualification, d.available_days, d.timings, d.room_number, d.photo
    FROM users u
    LEFT JOIN doctors d ON u.user_id = d.doctor_id
    WHERE u.user_id = ?
  `;
  db.query(sql, [doctorId], (err, results) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (results.length === 0) return res.json({ message: 'No profile found' });
    res.json(results[0]);
  });
});

// POST update doctor profile
app.post('/doctor/profile', requireDoctor, upload.single('profileImage'), (req, res) => {
  const doctorId = req.session.user.id;
  const { specialization, qualification, available_days, timings, room_number } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  let sql, params;

  if (photo) {
    // If a new photo is uploaded, include it in the update
    sql = `
      INSERT INTO doctors (doctor_id, specialization, qualification, available_days, timings, room_number, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        specialization = VALUES(specialization),
        qualification = VALUES(qualification),
        available_days = VALUES(available_days),
        timings = VALUES(timings),
        room_number = VALUES(room_number),
        photo = VALUES(photo)
    `;
    params = [doctorId, specialization, qualification, available_days, timings, room_number, photo];
  } else {
    // No new photo uploaded, keep the existing photo
    sql = `
      INSERT INTO doctors (doctor_id, specialization, qualification, available_days, timings, room_number)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        specialization = VALUES(specialization),
        qualification = VALUES(qualification),
        available_days = VALUES(available_days),
        timings = VALUES(timings),
        room_number = VALUES(room_number)
    `;
    params = [doctorId, specialization, qualification, available_days, timings, room_number];
  }
  db.query(sql, params, (err) => {
    if (err) {
      console.error('Doctor profile update error:', err);
      return res.status(500).send('Update failed');
    }
    res.send('✅ Profile updated successfully');
  });
});
app.get('/session', (req, res) => {
  res.json(req.session);
});

// Get today's appointments
// GET /doctor/appointments/today
app.get('/doctor/appointments/today', requireDoctor, (req, res) => {
  const doctorId = req.session.user.id; // from session

  const sql = `
      SELECT 
      a.appointment_id,
      a.appointment_date,
      a.appointment_time,
      a.reason,
      a.status,
      p.name AS patient_name
    FROM appointments a
    JOIN users p ON a.patient_id = p.user_id
    WHERE a.doctor_id = ? 
      AND a.appointment_date= CURDATE()
    ORDER BY a.appointment_time
  `;

  db.query(sql, [doctorId], (err, results) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    res.json(results);
  });
});


// POST /doctor/appointments/update
app.post('/doctor/appointments/update', requireDoctor, (req, res) => {
  const { appointment_id, status } = req.body;

  if (!appointment_id || !['pending','completed','Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const sql = `UPDATE appointments SET status = ? WHERE appointment_id = ? AND doctor_id = ?`;
  db.query(sql, [status, appointment_id, req.session.user.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Update failed' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Appointment not found' });
    res.json({ message: '✅ Appointment updated successfully' });
  });
});

// View lab tests for doctor’s patients
app.get('/doctor/lab-tests', requireDoctor, (req, res) => {
  const doctorId = req.session.user.id;
  const sql = `
   SELECT 
  lt.test_id,
  ltt.type_name AS test_type,
  lt.status,
  lt.findings,
  lt.values_json,
  u.name AS patient_name
FROM lab_tests lt
JOIN lab_test_types ltt ON lt.type_id = ltt.type_id
JOIN users u ON lt.patient_id = u.user_id
WHERE lt.doctor_id = ?
  `;
  db.query(sql, [doctorId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Failed to fetch lab tests' });
    res.json(results);
  });
});

app.get('/doctor/prescriptions', requireDoctor, (req, res) => {
  const doctorId = req.session.user_id;
  const sql = `
    SELECT p.*, u.name AS patient_name
    FROM prescriptions p
    JOIN users u ON p.patient_id = u.user_id
    WHERE p.doctor_id = ?
    ORDER BY p.prescription_date DESC
  `;
  db.query(sql, [doctorId], (err, results) => {
    if (err) return res.status(500).json({ message: 'DB error', error: err });
    res.json(results);
  });
});

// Submit a prescription
app.post('/doctor/prescriptions', requireDoctor, (req, res) => {
  const doctorId = req.session.user_id;
  const { patient_id, diagnosis, medicines, notes } = req.body;
  if (!patient_id || !diagnosis) {
    return res.status(400).json({ message: 'Patient ID and diagnosis are required' });
  }
  const sql = `
    INSERT INTO prescriptions (doctor_id, patient_id, diagnosis, medicines, notes, prescription_date)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  db.query(sql, [doctorId, patient_id, diagnosis, medicines, notes], (err) => {
    if (err) return res.status(500).json({ message: 'Failed to save prescription' });
    res.json({ message: '✅ Prescription saved successfully' });
  });
});
app.post('/doctor/prescriptions/create', async (req, res) => {
try{  const { appointment_id, diagnosis, medicines,instructions } = req.body;

  // Check appointment status
  const [appointment] = await queryAsync(
    'SELECT status, patient_id FROM appointments WHERE appointment_id = ?',
    [appointment_id]
  );

  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
  if (appointment.status !== 'pending') return res.status(400).json({ message: 'Cannot prescribe for completed/cancelled appointment' });

  // Insert prescription
  await queryAsync(
    `INSERT INTO prescriptions (appointment_id, patient_id, diagnosis, medicines,instructions, doctor_id, prescription_date) 
     VALUES (?, ?, ?, ?,?, ?, NOW())`,
    [appointment_id, appointment.patient_id, diagnosis, medicines,instructions, req.session.user.id] // doctor_id from session
  );

  res.json({ message: 'Prescription created successfully' });
}catch(err){
   console.error(err);
    res.status(500).json({ message: 'DB error', error: err });
}
});
app.get('/doctor/patient/:id/prescriptions', (req, res) => {
  const patientId = req.params.id;
  db.query(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY date DESC',
    [patientId],
    (err, results) => {
      if (err) return res.status(500).json({ message: err });
      res.json(results);
    }
  );
});
// Get all available lab test types
app.get('/doctor/lab-test-types', (req, res) => {
  db.query('SELECT type_id, type_name FROM lab_test_types', (err, results) => {
    if (err) {
      console.error('Lab test types fetch error:', err);
      return res.status(500).json({ message: 'Failed to fetch lab test types', error: err.message });
    }
    res.json(results); // send only the results array
  });
});





// Create a new lab test for a patient
app.post("/doctor/lab-tests/create", requireRole("doctor"), (req, res) => {
  const doctorId = req.session.user.user_id;
   console.log("Request body:", req.body);
  console.log("Session user:", req.session.user);
  const { patient_id, test_type, test_date } = req.body;

  if (!patient_id || !test_type || !test_date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = `
    INSERT INTO lab_tests (patient_id, doctor_id, test_type, test_date, status)
    VALUES (?, ?, ?, ?, ?)
  `;
  const values = [patient_id, doctorId, test_type, test_date, "Pending"];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error inserting lab test:", err);
      return res.status(500).json({ message: "Failed to create lab test" });
    }
    res.json({ message: "Lab test created successfully", labTestId: result.insertId });
  });
});


app.get("/api/patient/:id", (req, res) => {
  const patientId = req.params.id;
  const query = "SELECT * FROM users WHERE user_id = ?";
  db.query(query, [patientId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result[0]);
  });
});

// Update patient profile
// UPDATE patient profile (with optional profile image)
app.put("/api/patient/:id", upload.single("profileImage"), (req, res) => {
  const patientId = req.params.id;
  const { name, email, phone, gender, dob, address } = req.body;

  let query = `
    UPDATE users 
    SET name = ?, email = ?, phone = ?, gender = ?, dob = ?, address = ?
  `;
  const params = [name, email, phone, gender, dob, address];

  // If image uploaded, update profile_image column
  if (req.file) {
    query += ", profile_image = ?";
    params.push(`/uploads/${req.file.filename}`);
  }

  query += " WHERE user_id = ?";
  params.push(patientId);

  db.query(query, params, (err, result) => {
    if (err) return res.status(500).json({ error: err });

    // Return updated user data
    const updatedUser = {
      user_id: patientId,
      name,
      email,
      phone,
      gender,
      dob,
      address,
      profile_image: req.file ? `/uploads/${req.file.filename}` : undefined
    };

    res.json({ success: true, updatedUser });
  });
});

// Get upcoming appointments
app.get("/api/patient/:id/appointments", (req, res) => {
  const patientId = req.params.id;

  const query = `
    SELECT 
      a.appointment_id,
      a.doctor_id,
      a.patient_id,
      a.receptionist_id,
      a.appointment_date,
      a.appointment_time,
      a.reason,
      a.status,
      u.name AS doctor_name,
      d.specialization
    FROM appointments a
    JOIN users u ON a.doctor_id = u.user_id
    LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `;

  db.query(query, [patientId], (err, results) => {
    if (err) {
      console.error("Database error in /api/patient/:id/appointments:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results);
  });
});




9
// Get medical history (past appointments)
/*app.get("/api/patient/:id/history", (req, res) => {
  const patientId = req.params.id;
  const query = `
    SELECT * FROM appointments 
    WHERE patient_id = ? AND appointment_date < CURDATE()
    ORDER BY appointment_date DESC
  `;
  db.query(query, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});*/
// GET patient medical history
app.get('/api/patient/:id/medical-history', (req, res) => {
  const patientId = req.params.id;
  const query = `
    SELECT record_id, doctor_id, visit_date, diagnosis, treatment, notes, attachments
    FROM medical_records
    WHERE patient_id = ?
    ORDER BY visit_date DESC
  `;
  db.query(query, [patientId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results); // always return array
  });
});

// Get prescriptions
app.get("/api/patient/:id/prescriptions", (req, res) => {
  const patientId = req.params.id;
  const query = `
    SELECT p.*, d.name AS doctor_name 
    FROM prescriptions p
    JOIN users d ON p.doctor_id = d.user_id
    WHERE p.patient_id = ?
    ORDER BY p.prescription_date DESC
  `;
  db.query(query, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Get lab tests
app.get("/api/patient/:id/lab-tests", async (req, res) => {
  const { id } = req.params;

  try {
    const results = await queryAsync(
      `SELECT l.*, u.name AS doctor_name
       FROM lab_tests l
       JOIN users u ON l.doctor_id = u.user_id
       WHERE l.patient_id = ?
       ORDER BY l.report_date DESC`,
      [id]
    );

    // Ensure it always returns an array
    res.json(results || []);
  } catch (err) {
    console.error("Lab tests error:", err);
    res.status(500).json({ error: "Error fetching lab tests" });
  }
});


// ================== SERVER ================== //
// Continue with doctor-specific profile and appointment routes...
// (You can paste the remaining doctor routes you already have)
// ====== BOOK APPOINTMENT FOR PATIENT ======
app.post("/api/patient/:id/appointments", (req, res) => {
  const patientId = req.params.id;
  const { doctor_id, appointment_date, appointment_time, reason } = req.body;

  if (!doctor_id) {
    return res.status(400).json({ success: false, message: "Doctor required" });
  }

  const sql = `
    INSERT INTO appointments 
      (patient_id, doctor_id, appointment_date, appointment_time, reason, status) 
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;

  db.query(sql, [patientId, doctor_id, appointment_date, appointment_time, reason], (err, result) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ success: false, error: err });
    }
    res.json({ success: true, appointmentId: result.insertId });
  });
});
// ========================
// ADMIN: Create Announcement
// ========================
app.post('/api/admin/announcements', (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: 'Title and content required' });
  }

  db.query(
    'INSERT INTO announcements (title, content) VALUES (?, ?)',
    [title, content],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });
      res.json({ message: 'Announcement added successfully' });
    }
  );
});


// ========================
// PATIENT: View Notifications (Show announcements)
// ========================
// backend/routes/patient.js
app.get('/api/patient/:patientId/notifications', (req, res) => {
  const query = 'SELECT title, content, created_at FROM announcements ORDER BY created_at DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching notifications:", err);
      return res.status(500).json({ message: 'Database error' });
    }
    // Map results to { message, created_at } for frontend
    const notifications = results.map(r => ({
      message: r.title + ": " + r.content,
      created_at: r.created_at
    }));
    res.json(notifications);
  });
});



// ====== GET DOCTORS LIST ======
app.get("/api/doctors", async (req, res) => {
  try {
    const results = await queryAsync(
      `SELECT u.user_id, u.name, d.specialization
       FROM users u
       JOIN doctors d ON u.user_id = d.doctor_id
       WHERE u.role = 'doctor'`
    );
    res.json(results || []);
  } catch (err) {
    console.error("Doctors error:", err);
    res.status(500).json({ error: "Error fetching doctors" });
  }
});



// ================== MESSAGES ==================

// Get patient messages
app.get("/api/patient/:id/messages", (req, res) => {
  const patientId = req.params.id;
  const sql = `
    SELECT m.message_id, m.message, m.from_id, u.name AS from_name, m.created_at
    FROM messages m
    JOIN users u ON m.from_id = u.user_id
    WHERE m.to_id = ?
    ORDER BY m.created_at DESC
  `;
  db.query(sql, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Send message to a doctor
app.get("/api/patient/:id/messages", (req, res) => {
  const patientId = req.params.id;
  const sql = `
    SELECT m.message_id, m.message, m.from_id, u.name AS from_name, m.created_at
    FROM messages m
    JOIN users u ON m.from_id = u.user_id
    WHERE m.to_id = ?
    ORDER BY m.created_at DESC
  `;
  db.query(sql, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

app.post("/api/patient/:id/messages", (req, res) => {
  const patientId = req.params.id;
  const { doctorId, message } = req.body;
  if (!doctorId || !message) return res.status(400).json({ message: "Doctor ID and message required" });

  const sql = `
    INSERT INTO messages (from_id, to_id, message, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  db.query(sql, [patientId, doctorId, message], (err) => {
    if (err) return res.status(500).json({ message: "Failed to send message" });
    res.json({ message: "✅ Message sent successfully" });
  });
});

// ================== NOTIFICATIONS ==================

// Get patient notifications
app.get("/api/patient/:id/notifications", (req, res) => {
  const patientId = req.params.id;
  const sql = `
    SELECT * FROM notifications
    WHERE patient_id = ?
    ORDER BY created_at DESC
  `;
  db.query(sql, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// ================== BILLING ==================

// Get patient billing
app.get("/api/patient/:id/billing", (req, res) => {
  const patientId = req.params.id;
  const sql = `
    SELECT * FROM billing
    WHERE patient_id = ?
    ORDER BY bill_date DESC
  `;
  db.query(sql, [patientId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results||[]);
  });
});

// Pay a bill
app.post("/api/patient/:id/billing/:billId/pay", (req, res) => {
  const patientId = req.params.id;
  const billId = req.params.billId;

  const sql = `
    UPDATE billing
    SET status = 'paid'
    WHERE bill_id = ? AND patient_id = ?
  `;
  db.query(sql, [billId, patientId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Bill not found" });
    res.json({ message: "✅ Bill paid successfully" });
  });
});
// server.js
// Requires util.promisify if using async/await with db.query
app.get("/api/patient/:id/overview", async (req, res) => {
  const { id } = req.params;

  try {
    // Count upcoming appointments
    const appointments = await queryAsync(
      "SELECT COUNT(*) AS count FROM appointments WHERE patient_id = ? AND appointment_date >= CURDATE()",
      [id]
    );

    // Count medical history
    const history = await queryAsync(
      "SELECT COUNT(*) AS count FROM medical_records WHERE patient_id = ?",
      [id]
    );

    // Count active prescriptions
    const prescriptions = await queryAsync(
      "SELECT COUNT(*) AS count FROM prescriptions WHERE patient_id = ?",
      [id]
    );

    // Get patient profile for completion %
    const profile = await queryAsync(
      "SELECT name, email, phone, dob, gender, address FROM users WHERE user_id = ? AND role = 'patient'",
      [id]
    );

    let profileCompletion = 0;
    if (profile.length > 0) {
      let filled = 0;
      let total = Object.keys(profile[0]).length;
      for (let key in profile[0]) {
        if (profile[0][key]) filled++;
      }
      profileCompletion = Math.round((filled / total) * 100);
    }

    res.json({
      upcomingAppointments: appointments[0]?.count || 0,
      medicalHistoryCount: history[0]?.count || 0,
      activePrescriptions: prescriptions[0]?.count || 0,
      profileCompletion
    });
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ error: "Error loading patient overview" });
  }
});

app.get('/api/doctors', (req, res) => {
  const sql = `
    SELECT d.doctor_id, u.name, d.specialization, d.qualification, d.available_days, d.timings, d.room_number, d.photo
    FROM doctors d
    LEFT JOIN users u ON d.doctor_id = u.user_id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ error: 'Failed to fetch doctors' });
    }
    res.json(results);
  });
});


// -------------------- Get Doctor Schedules --------------------
app.get('/api/schedules', (req, res) => {
  const sql = `
    SELECT s.schedule_id, s.doctor_id, u.name AS doctor_name, s.day, s.start_time, s.end_time, s.room
    FROM doctor_schedule s
    JOIN doctors d ON s.doctor_id = d.doctor_id
    JOIN users u ON d.doctor_id = u.user_id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ error: 'Failed to fetch schedules' });
    }
    res.json(results);
  });
});


// -------------------- Today's Appointments (Receptionist view) --------------------
app.get('/api/reception/appointments/today', (req, res) => {
  const sql = `
    SELECT a.appointment_id, a.doctor_id, a.patient_id, a.appointment_time, a.reason, a.status,
           u.name AS patient_name,
           d.name AS doctor_name,
           b.amount AS bill_amount,
           b.status AS bill_status
    FROM appointments a
    JOIN users u ON a.patient_id = u.user_id
    JOIN users d ON a.doctor_id = d.user_id
    LEFT JOIN bills b ON a.patient_id = b.patient_id
    WHERE DATE(a.appointment_date) = CURDATE()
    ORDER BY a.appointment_time
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('MySQL error:', err);
      return res.status(500).json({ error: 'Failed to fetch today appointments' });
    }
    res.json(results);
  });
});


// -------------------- Update Appointment Status & Bill --------------------
app.put('/api/reception/appointments/:id/update', async (req, res) => {
  const { status, bill_amount, bill_status } = req.body;
  const appointmentId = req.params.id;

  await db.query('UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, appointmentId]);

  if (bill_amount !== undefined && bill_status !== undefined) {
    await db.query(`
      INSERT INTO bills (patient_id, amount, status, due_date)
      SELECT patient_id, ?, ?, NOW() FROM appointments WHERE appointment_id = ?
      ON DUPLICATE KEY UPDATE amount = ?, status = ?
    `, [bill_amount, bill_status, appointmentId, bill_amount, bill_status]);
  }

  res.json({ message: 'Appointment updated successfully' });
});

// -------------------- Add Appointment --------------------
app.post('/api/reception/appointments', async (req, res) => {
  const { patient_id, doctor_id, time, reason } = req.body;
  const receptionist_id = req.session.user.user_id;
  await db.query(`
    INSERT INTO appointments (doctor_id, patient_id, receptionist_id, appointment_time, appointment_date, reason, status)
    VALUES (?, ?, ?, ?, CURDATE(), ?, 'Waiting')
  `, [doctor_id, patient_id, receptionist_id, time, reason]); // receptionist_id = 1 as example
  res.json({ message: 'Appointment created successfully' });
});

// -------------------- Add Patient --------------------
app.post('/api/reception/patients', (req, res) => {
  const { name, email, phone, gender, dob, address } = req.body;

  // Optional: validate required fields
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  db.query(
    `INSERT INTO users (name, email, role, phone, gender, dob, address)
     VALUES (?, ?, 'patient', ?, ?, ?, ?)`,
    [name, email, phone, gender, dob, address],
    (err, result) => {
      if (err) {
        console.error('MySQL Error:', err);
        return res.status(500).json({ error: 'Failed to register patient' });
      }
      res.json({ message: 'Patient registered successfully', user_id: result.insertId });
    }
  );
});



// Count today's appointments
// Count today's appointments
app.get('/api/reception/appointments/today/count', (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM appointments WHERE DATE(appointment_date) = CURDATE()`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to get appointments count' });
    }
    res.json({ total: results[0].total });
  });
});

// Count new patients registered today
app.get('/api/reception/patients/new/count', (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM users WHERE role='patient' AND DATE(created_at) = CURDATE()`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to get patients count' });
    }
    res.json({ total: results[0].total });
  });
});

// Count all doctors
app.get('/api/reception/doctors/count', (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM doctors`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to get doctors count' });
    }
    res.json({ total: results[0].total });
  });
});

// Count all scheduled slots
app.get('/api/reception/schedules/count', (req, res) => {
  const sql = `SELECT COUNT(*) AS total FROM doctor_schedule`;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to get schedules count' });
    }
    res.json({ total: results[0].total });
  });
});

// Get receptionist profile (based on logged in user)
// Get receptionist profile
app.get('/api/reception/profile', (req, res) => {
  const receptionistId = req.session.user.id; // assuming session stores logged-in user id

  const sql = `
    SELECT user_id, name, email, phone, gender, dob, address
    FROM users
    WHERE user_id = ? AND role = 'receptionist'
  `;

  db.query(sql, [receptionistId], (err, results) => {
    if (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({ error: 'Failed to load profile' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(results[0]); // return profile data
  });
});


// Update profile
app.put('/api/reception/profile', (req, res) => {
  const receptionistId = req.session?.user.id; // or from JWT
  const { name, email, phone, gender, dob, address } = req.body;

  if (!receptionistId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const sql = `
    UPDATE users 
    SET name = ?, email = ?, phone = ?, gender = ?, dob = ?, address = ?
    WHERE user_id = ? AND role = 'receptionist'
  `;

  db.query(sql, [name, email, phone, gender, dob, address, receptionistId], (err, result) => {
    if (err) {
      console.error('Error updating profile:', err);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
    res.json({ message: 'Profile updated successfully' });
  });
});

// =================== Admin Dashboard Counts ===================
app.get('/api/admin/dashboard', (req, res) => {
  const queries = {
    doctors: 'SELECT COUNT(*) AS total FROM doctors',
    patients: 'SELECT COUNT(*) AS total FROM users WHERE role="patient"',
    appointments: 'SELECT COUNT(*) AS total FROM appointments',
    staff: 'SELECT COUNT(*) AS total FROM users WHERE role IN ("receptionist", "pharmacist", "staff")'
  };

  const results = {};

  db.query(queries.doctors, (err, doctorRes) => {
    if (err) return res.status(500).json({ message: 'Error counting doctors' });
    results.totalDoctors = doctorRes[0].total;

    db.query(queries.patients, (err, patientRes) => {
      if (err) return res.status(500).json({ message: 'Error counting patients' });
      results.totalPatients = patientRes[0].total;

      db.query(queries.appointments, (err, appRes) => {
        if (err) return res.status(500).json({ message: 'Error counting appointments' });
        results.totalAppointments = appRes[0].total;

        db.query(queries.staff, (err, staffRes) => {
          if (err) return res.status(500).json({ message: 'Error counting staff' });
          results.totalStaff = staffRes[0].total;

          res.json(results);
        });
      });
    });
  });
});

// -------------------- Get All Patients --------------------
app.get('/api/admin/patients', (req, res) => {
  db.query("SELECT * FROM users WHERE role='patient'", (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching patients" });
    res.json(rows);
  });
});

// ---------- DOCTORS ----------
// Today's appointments
/*app.get('/api/admin/appointments/today', (req, res) => {
  db.query(
    `SELECT a.*, d.name AS doctor_name, p.name AS patient_name
     FROM appointments a
     JOIN users d ON a.doctor_id=d.user_id
     JOIN users p ON a.patient_id=p.user_id
     WHERE DATE(a.appointment_date)=CURDATE()`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Error fetching today's appointments" });
      res.json(rows);
    }
  );
});*/

// Get all doctors
app.get('/api/admin/doctors', (req, res) => {
  db.query(`
    SELECT u.user_id, u.name, u.email, d.specialization, d.qualification, d.available_days, d.timings, d.room_number, d.photo
    FROM users u 
    JOIN doctors d ON u.user_id = d.doctor_id
  `, (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching doctors" });
    res.json(rows);
  });
});

// Add a doctor
app.post('/api/admin/doctors', (req, res) => {
  const { name, email, password, phone, gender, dob, address, specialization, qualification, available_days, timings, room_number, photo } = req.body;

  // Step 1: Insert into users
  db.query(
    "INSERT INTO users (name, email, password, role, phone, gender, dob, address) VALUES (?,?,?,?,?,?,?,?)",
    [name, email, password, 'doctor', phone, gender, dob, address],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Error adding doctor user" });

      const doctor_id = result.insertId;

      // Step 2: Insert into doctors table
      db.query(
        "INSERT INTO doctors (doctor_id, specialization, qualification, available_days, timings, room_number, photo) VALUES (?,?,?,?,?,?,?)",
        [doctor_id, specialization, qualification, available_days, timings, room_number, photo],
        err2 => {
          if (err2) return res.status(500).json({ message: "Error adding doctor details" });
          res.json({ message: "Doctor added successfully" });
        }
      );
    }
  );
});

// Delete a doctor (delete from doctors then users)
/*app.delete('/api/admin/doctors/:id', (req, res) => {
  const id = req.params.id;
  db.query("DELETE FROM doctors WHERE doctor_id=?", [id], err => {
    if (err) return res.status(500).json({ message: "Error deleting doctor details" });
    db.query("DELETE FROM users WHERE user_id=?", [id], err2 => {
      if (err2) return res.status(500).json({ message: "Error deleting doctor user" });
      res.json({ message: "Doctor deleted successfully" });
    });
  });
});*/
// =================== Delete Doctor ===================
app.delete('/api/admin/doctors/:id', (req, res) => {
  const { id } = req.params;

  // Delete from doctors table first
  db.query('DELETE FROM doctors WHERE doctor_id=?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting doctor details' });

    // Then delete from users table
    db.query('DELETE FROM users WHERE user_id=?', [id], (err2) => {
      if (err2) return res.status(500).json({ message: 'Error deleting doctor user' });
      res.json({ message: 'Doctor deleted successfully' });
    });
  });
});



// ---------- STAFF ----------

// Get all staff
// Get all staff members (with user info + staff info)
app.get('/api/admin/staff', (req, res) => {
  const query = `
    SELECT u.user_id, u.name, u.email, u.phone, u.gender, u.dob, u.address,
           s.staff_id, s.position, s.shift, s.department
    FROM staff s
    JOIN users u ON s.staff_id = u.user_id
  `;
  db.query(query, (err, rows) => {
    if (err) return res.status(500).json({ message: "Error fetching staff" });
    res.json(rows);
  });
});

// Delete a staff member (removes from users → cascades to staff)
app.delete('/api/admin/staff/:id', (req, res) => {
  const { id } = req.params;

  // Delete from doctors table first
  db.query('DELETE FROM staff WHERE staff_id=?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting doctor details' });

    // Then delete from users table
    db.query('DELETE FROM users WHERE user_id=?', [id], (err2) => {
      if (err2) return res.status(500).json({ message: 'Error deleting doctor user' });
      res.json({ message: 'Doctor deleted successfully' });
    });
  });
});

// Add a new staff member
app.post('/api/admin/staff', (req, res) => {
  const { name, email, password, phone, gender, dob, address, position, shift, department } = req.body;

  // First insert into users (role = 'staff')
  const userQuery = `
    INSERT INTO users (name, email, password, role, phone, gender, dob, address) 
    VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)
  `;
  db.query(userQuery, [name, email, password, phone, gender, dob, address], (err, result) => {
    if (err) return res.status(500).json({ message: "Error adding user", error: err });

    const userId = result.insertId; // user_id generated

    // Then insert into staff table
    const staffQuery = `
      INSERT INTO staff (staff_id, position, shift, department) 
      VALUES (?, ?, ?, ?)
    `;
    db.query(staffQuery, [userId, position, shift, department], (err2) => {
      if (err2) return res.status(500).json({ message: "Error adding staff details", error: err2 });

      res.json({ message: "Staff added successfully", staffId: userId });
    });
  });
});

// ---------- PROFILE ----------

// Get admin profile
// ================= Admin Profile Routes =================

// Get admin profile
app.get('/api/admin/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }

  // Ensure only admin can access
  if (req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Not an admin" });
  }

  const { id } = req.session.user;
  //console.log("Session user:", req.session.user); 

  db.query(
    "SELECT user_id, name, email, phone, address FROM users WHERE user_id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (!result.length) return res.status(404).json({ message: "User not found" });
      res.json(result[0]);
    }
  );
});

// Update admin profile
app.put('/api/admin/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not logged in" });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Not an admin" });
  }

  const { id } = req.session.user;
  const { name, email, phone, address } = req.body;

  db.query(
    "UPDATE users SET name = ?, email = ?, phone = ?, address = ? WHERE user_id = ?",
    [name, email, phone, address, id],
    (err) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json({ message: "Profile updated successfully" });
    }
  );
});


// Get all staff tasks
app.get('/api/admin/tasks', (req, res) => {
  db.query(`
    SELECT t.*, u.name AS staff_name
    FROM staff_tasks t
    JOIN users u ON t.user_id = u.user_id
    ORDER BY t.deadline ASC
  `, (err, rows) => {
    if(err) return res.status(500).json({ message: "Error fetching tasks" });
    res.json(rows);
  });
});

// Add a task
app.post('/api/admin/tasks', (req, res) => {
  const { user_id, task_name, deadline } = req.body;
  db.query(`
    INSERT INTO staff_tasks (user_id, task_name, deadline) VALUES (?, ?, ?)
  `, [user_id, task_name, deadline], (err) => {
    if(err) return res.status(500).json({ message: "Error adding task" });
    res.json({ message: "Task added successfully" });
  });
});

// Update task status
app.put('/api/admin/tasks/:id', (req, res) => {
  const { status } = req.body;
  db.query(`UPDATE staff_tasks SET status=? WHERE task_id=?`, [status, req.params.id], (err) => {
    if(err) return res.status(500).json({ message: "Error updating task" });
    res.json({ message: "Task updated successfully" });
  });
});
// Get staff duty schedule
app.get('/api/admin/duties', (req, res) => {
  db.query(`
    SELECT d.*, u.name AS staff_name
    FROM staff_duty d
    JOIN users u ON d.user_id = u.user_id
    ORDER BY d.duty_date ASC
  `, (err, rows) => {
    if(err) return res.status(500).json({ message: "Error fetching duties" });
    res.json(rows);
  });
});

// Assign a duty
app.post('/api/admin/duties', (req, res) => {
  const { user_id, duty_date, shift, department, role_assigned } = req.body;
  db.query(`
    INSERT INTO staff_duty (user_id, duty_date, shift, department, role_assigned)
    VALUES (?, ?, ?, ?, ?)
  `, [user_id, duty_date, shift, department, role_assigned], (err) => {
    if(err) return res.status(500).json({ message: "Error assigning duty" });
    res.json({ message: "Duty assigned successfully" });
  });
});
// Get all announcements
app.get('/api/admin/announcements', (req, res) => {
  db.query(`SELECT * FROM announcements ORDER BY created_at DESC`, (err, rows) => {
    if(err) return res.status(500).json({ message: "Error fetching announcements" });
    res.json(rows);
  });
});

// Add an announcement
app.post('/api/admin/announcements', (req, res) => {
  const { title, content } = req.body;
  db.query(`INSERT INTO announcements (title, content) VALUES (?, ?)`, [title, content], (err) => {
    if(err) return res.status(500).json({ message: "Error adding announcement" });
    res.json({ message: "Announcement posted successfully" });
  });
});

// Middleware to check user role
// Middleware: role check
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }
    if (req.session.user.role !== role) {
      return res.status(403).json({ message: "Access denied: not " + role });
    }
    next();
  };
}

// ✅ Get logged-in pharmacist info
app.get("/api/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ message: "Not logged in" });

  const { user_id, role, name } = req.session.user;
  res.json({ id: user_id, role, name });
});

// Pharmacist Dashboard
app.get("/api/pharmacist/dashboard", requireRole("pharmacist"), (req, res) => {
  const stats = {};

  db.query("SELECT COUNT(*) AS total FROM medicines", (err, result) => {
    if (err) {
      console.error("Error fetching total medicines:", err);
      return res.status(500).json({ message: "Error fetching total medicines" });
    }
    stats.totalMedicines = result[0]?.total || 0;

    db.query(
      "SELECT COUNT(*) AS today FROM prescriptions WHERE DATE(prescription_date) = CURDATE()",
      (err2, result2) => {
        if (err2) {
          console.error("Error fetching today's prescriptions:", err2);
          return res.status(500).json({ message: "Error fetching today's prescriptions" });
        }
        stats.prescriptionsToday = result2[0]?.today || 0;

        db.query(
          "SELECT COUNT(*) AS low FROM medicines WHERE quantity < 10",
          (err3, result3) => {
            if (err3) {
              console.error("Error fetching low stock medicines:", err3);
              return res.status(500).json({ message: "Error fetching low stock medicines" });
            }
            stats.lowStock = result3[0]?.low || 0;

            db.query(
              "SELECT COUNT(*) AS expired FROM medicines WHERE expiry_date < CURDATE()",
              (err4, result4) => {
                if (err4) {
                  console.error("Error fetching expired medicines:", err4);
                  return res.status(500).json({ message: "Error fetching expired medicines" });
                }
                stats.expiredMeds = result4[0]?.expired || 0;

                res.json(stats);
              }
            );
          }
        );
      }
    );
  });
});


// Pharmacist Profile - GET
app.get("/api/pharmacist/profile", requireRole("pharmacist"), (req, res) => {
  const user_id = req.session.user.user_id;

  db.query(
    "SELECT user_id, name, email, phone, gender, dob, address FROM users WHERE user_id=? AND role='pharmacist'",
    [user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);

      if (!result || result.length === 0) {
        return res.status(404).json({ message: "Pharmacist not found" });
      }

      res.json(result[0]);
    }
  );
});

// Pharmacist Profile - UPDATE
app.put("/api/pharmacist/profile", requireRole("pharmacist"), (req, res) => {
  const user_id = req.session.user.user_id;
  const { name, phone, gender, dob, address } = req.body;

  db.query(
    "UPDATE users SET name=?, phone=?, gender=?, dob=?, address=? WHERE user_id=? AND role='pharmacist'",
    [name, phone, gender, dob, address, user_id],
    (err, result) => {
      if (err) return res.status(500).json(err);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Pharmacist not found or no changes made" });
      }

      res.json({ message: "Profile updated successfully" });
    }
  );
});

// Medicines APIs
app.get("/api/medicines", requireRole("pharmacist"), (req, res) => {
  db.query("SELECT * FROM medicines", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.post("/api/medicines", requireRole("pharmacist"), (req, res) => {
  const pharmacistId = req.session.user.user_id;
  const { name, quantity, category, price, expiry_date, company } = req.body;

  db.query(
    "INSERT INTO medicines (name, quantity, category, price, expiry_date, added_by, company) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [name, quantity, category, price, expiry_date, pharmacistId, company],
    (err, result) => {
      if (err) {
        console.error("Error inserting medicine:", err);
        return res.status(500).send(err);
      }
      res.json({ id: result.insertId, pharmacistId, ...req.body });
    }
  );
});

app.get("/api/medicines/expired", requireRole("pharmacist"), (req, res) => {
  db.query(
    "SELECT * FROM medicines WHERE expiry_date < CURDATE()",
    (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    }
  );
});

// Prescriptions APIs
app.get("/api/prescriptions", requireRole("pharmacist"), (req, res) => {
  db.query("SELECT * FROM prescriptions", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

app.post("/api/prescriptions", requireRole("pharmacist"), (req, res) => {
  const { appointment_id, doctor_id, patient_id, prescription_date, diagnosis, medicines, instructions } = req.body;

  db.query(
    "INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, prescription_date, diagnosis, medicines, instructions) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [appointment_id, doctor_id, patient_id, prescription_date, diagnosis, medicines, instructions],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json({ id: result.insertId, ...req.body });
    }
  );
});






// Today's duty
app.get("/api/staff/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  const dashboardData = {};

  // 1) All tasks
  db.query("SELECT * FROM staff_tasks WHERE user_id=?", [userId], (err, tasks) => {
    if (err) {
      console.error("Error fetching staff_tasks:", err);
      return res.status(500).json({ error: "Error fetching tasks" });
    }
    dashboardData.tasks = tasks || [];

    // 2) Today's duties (all)
    db.query(
      "SELECT * FROM staff_duty WHERE user_id=?",
      [userId],
      (err, todayDuties) => {
        if (err) {
          console.error("Error fetching today's duty:", err);
          return res.status(500).json({ error: "Error fetching today's duty" });
        }
        dashboardData.todayDuty = todayDuties || [];

        // 3) All duties for this staff
        db.query("SELECT * FROM staff_duty WHERE user_id=?", [userId], (err, duties) => {
          if (err) {
            console.error("Error fetching duties:", err);
            return res.status(500).json({ error: "Error fetching duties" });
          }
          dashboardData.duties = duties || [];

          // 4) Latest announcements (limit 5)
          db.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5", (err, announcements) => {
            if (err) {
              console.error("Error fetching announcements:", err);
              return res.status(500).json({ error: "Error fetching announcements" });
            }
            dashboardData.announcements = announcements || [];

            // 5) Count messages from admin to this user
            db.query(
              "SELECT COUNT(*) AS count FROM messages WHERE to_id=? AND from_id=(SELECT user_id FROM users WHERE role='admin' LIMIT 1)",
              [userId],
              (err, messagesCount) => {
                if (err) {
                  console.error("Error counting admin messages:", err);
                  return res.status(500).json({ error: "Error fetching message count" });
                }
                dashboardData.adminMessages = (messagesCount && messagesCount[0]) ? messagesCount[0].count : 0;
                return res.json(dashboardData);
              }
            );
          });
        });
      }
    );
  });
});


// Send message from staff -> admin
// Body: { sender_id, subject, message }  (subject optional)
app.post("/api/staff/message", (req, res) => {
  const { sender_id, subject, message } = req.body;
  if (!sender_id || !message) return res.status(400).json({ error: "sender_id and message required" });

  getAdminId((err, adminId) => {
    if (err) {
      console.error("No admin found:", err);
      return res.status(500).json({ error: "No admin available" });
    }

    // Insert into messages. Adjust columns if your messages table differs.
    // We're using columns: from_id, to_id, subject, message, created_at
    db.query(
      "INSERT INTO messages (from_id, to_id, subject, message, created_at) VALUES (?,?,?,?,NOW())",
      [sender_id, adminId, subject || null, message],
      (err) => {
        if (err) {
          console.error("Error inserting message:", err);
          return res.status(500).json({ error: "Error sending message" });
        }
        res.json({ message: "Message sent to admin successfully!" });
      }
    );
  });
});

// Get staff profile (GET)
app.get("/api/staff/profile/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("SELECT user_id, name, email, phone, gender, dob, address FROM users WHERE user_id=? AND role='staff'", [userId], (err, rows) => {
    if (err) {
      console.error("Error fetching staff profile:", err);
      return res.status(500).json({ error: "Error fetching profile" });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ error: "Staff not found" });
    res.json(rows[0]);
  });
});

// Update staff profile (PUT) — NOTE: fixed route leading slash
app.put("/api/staff/profile/:userId", (req, res) => {
  const userId = req.params.userId;
  const { name, phone, gender, dob, address } = req.body;

  db.query(
    "UPDATE users SET name=?, phone=?, gender=?, dob=?, address=? WHERE user_id=? AND role='staff'",
    [name, phone, gender, dob, address, userId],
    (err, result) => {
      if (err) {
        console.error("Error updating staff profile:", err);
        return res.status(500).json({ error: "Error updating profile" });
      }
      res.json({ message: "Profile updated successfully" });
    }
  );
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});