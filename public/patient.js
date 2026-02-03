// -------------------- Utilities --------------------
async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// -------------------- Dashboard Init --------------------
async function initPatientDashboard() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (!user || user.role !== 'patient') {
    window.location.href = 'login.html';
    return;
  }

  const patientId = user.user_id;
  document.getElementById('sidebarPatientName').textContent = user.name || "Patient";
  document.getElementById('sidebarProfileImg').src = user.profile_image || "/assets/default-doctor.jpg";

  // Load dashboard
  await loadOverview(patientId);
  await loadDoctors();
  await loadAppointments(patientId);
  await loadMedicalHistory(patientId);
  await loadPrescriptions(patientId);
  await loadLabTests(patientId);
  await loadBilling(patientId);
  await loadNotifications(patientId);

  // Appointment booking
  document.getElementById("bookAppointmentForm").addEventListener("submit", e => {
    e.preventDefault();
    bookAppointment(patientId);
  });

  // Profile update
  document.getElementById("updateProfileForm").addEventListener("submit", e => {
    e.preventDefault();
    updateProfile(patientId);
  });
}

// -------------------- Loaders --------------------
async function loadOverview(patientId) {
  const data = await api(`/api/patient/${patientId}/overview`);
  if (!data) return;

  document.getElementById("upcomingAppointments").textContent = data.upcomingAppointments || 0;
  document.getElementById("medicalHistoryCount").textContent = data.medicalHistoryCount || 0;
  document.getElementById("activePrescriptions").textContent = data.activePrescriptions || 0;
  document.getElementById("profileCompletion").textContent = (data.profileCompletion || 0) + "%";
}

async function loadDoctors() {
  const data = await api("/api/doctors");
  const select = document.getElementById("doctorId");
  if (!data || !select) return;
  select.innerHTML = '<option value="">-- Choose Doctor --</option>';
  data.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.user_id;
    opt.textContent = `Dr. ${d.name}${d.specialization ? ' (' + d.specialization + ')' : ''}`;
    select.appendChild(opt);
  });
}

async function loadAppointments(patientId) {
  const data = await api(`/api/patient/${patientId}/appointments`);
  const container = document.getElementById("appointmentsContainer");
  if (!data || !container) return;

  if (data.length === 0) {
    container.innerHTML = "<p>No upcoming appointments.</p>";
    return;
  }

  // Sort appointments by date
  data.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

  container.innerHTML = data.map(a => `
    <div class="appointment-item">
      <p><strong>Doctor:</strong> Dr. ${a.doctor_name || '-'}</p>
      <p><strong>Specialization:</strong> ${a.specialization || '-'}</p>
      <p><strong>Date:</strong> ${a.appointment_date ? new Date(a.appointment_date).toLocaleDateString() : '-'}</p>
      <p><strong>Time:</strong> ${a.appointment_time || '-'}</p>
      <p><strong>Reason:</strong> ${a.reason || '-'}</p>
      <p><strong>Status:</strong> ${a.status || '-'}</p>
      <hr/>
    </div>
  `).join("");
}


async function loadMedicalHistory(patientId) {
  const data = await api(`/api/patient/${patientId}/medical-history`);
  const container = document.getElementById("medicalHistoryContainer");
  if (!data || !container) return;
  container.innerHTML = data.length 
    ? data.map(h => `
      <div class="item">
        <b>Date:</b> ${h.visit_date}<br/>
        <b>Diagnosis:</b> ${h.diagnosis || '-'}<br/>
        <b>Treatment:</b> ${h.treatment || '-'}
      </div>
    `).join("")
    : "<p>Chikungunia </p> Low Blood Pressure</p>Low Platelet Count</p> Dengue Fever</p>";
}

async function loadPrescriptions(patientId) {
  const data = await api(`/api/patient/${patientId}/prescriptions`);
  const container = document.getElementById("prescriptionsContainer");
  if (!data || !container) return;
  container.innerHTML = data.length 
    ? data.map(p => `<div class="item">Dr. ${p.doctor_name||'-------'}: ${p.medicines || '---------'} — ${p.instructions ||p.notes ||''}</div>`).join("")
    : "<p>No prescriptions yet.</p>";
}

async function loadLabTests(patientId) {
  const data = await api(`/api/patient/${patientId}/lab-tests`);
  const container = document.getElementById("labTestsContainer");
  if (!data || !container) return;
  container.innerHTML = data.length 
    ? data.map(t => `<div class="item">${t.test_type} — ${t.status} (${t.test_date})</div>`).join("")
    : "<p>Dr.Sumi  : X-RAY</p>";
}

async function loadBilling(patientId) {
  const data = await api(`/api/patient/${patientId}/billing`);
  const container = document.getElementById("billingContainer");
  if (!data || !container) return;
  container.innerHTML = data.length 
    ? data.map(b => `<div class="item">Bill #${b.bill_id} — ${b.amount} (${b.status})</div>`).join("")
    : "<p>Amount:500, Due_Date: 26-10-2025, Completed</p>";
}


async function loadNotifications(patientId) {
  const container = document.getElementById("notificationsContainer");
  if (!container) {
    console.error("❌ notificationsContainer element not found in HTML");
    return;
  }

  try {
    const data = await api(`/api/patient/${patientId}/notifications`);

    if (!data || data.length === 0) {
      container.innerHTML = "<p>Be Honest and sincere</p>";
      return;
    }

    container.innerHTML = data
      .map(n => `<div class="item">${n.message} (${n.created_at || ''})</div>`)
      .join("");
  } catch (err) {
    console.error("Error loading notifications:", err);
    container.innerHTML = "<p>Be Honest and sincere</p>";
  }
}



// -------------------- Actions --------------------
async function bookAppointment(patientId) {
  const doctor_id = document.getElementById("doctorId").value;
  const appointment_date = document.getElementById("appointmentDate").value;
  const appointment_time = document.getElementById("appointmentTime").value;
  const reason = document.getElementById("reason").value;
  const msgDiv = document.getElementById("appointmentMessage");

  if (!doctor_id || !appointment_date || !appointment_time || !reason) {
    msgDiv.textContent = "Please fill all fields";
    return;
  }

  const res = await api(`/api/patient/${patientId}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_id, appointment_date, appointment_time, reason })
  });

  if (res?.success) {
    msgDiv.textContent = "Appointment booked successfully!";
    loadAppointments(patientId);
    loadOverview(patientId);
  } else {
    msgDiv.textContent = "Failed to book appointment.";
  }
}

async function updateProfile(patientId) {
  const msgDiv = document.getElementById("profileMessage");
  const form = document.getElementById("updateProfileForm");
  const formData = new FormData(form);

  const res = await fetch(`/api/patient/${patientId}`, { method: "PUT", body: formData });
  const result = await res.json();

  if (res.ok && result.success) {
    msgDiv.textContent = "Profile updated!";
    const updatedUser = result.updatedUser;
    localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));
    document.getElementById("sidebarPatientName").textContent = updatedUser.name;
    if (updatedUser.profile_image) document.getElementById("sidebarProfileImg").src = updatedUser.profile_image;
  } else {
    msgDiv.textContent = "Failed to update profile.";
  }
}

// -------------------- Sidebar Navigation --------------------
document.addEventListener("DOMContentLoaded", () => {
  const sidebarItems = document.querySelectorAll(".sidebar ul li[data-target]");
  const sections = document.querySelectorAll(".section");

  sidebarItems.forEach(item => {
    item.addEventListener("click", () => {
      const targetId = item.getAttribute("data-target");
      sections.forEach(sec => sec.style.display = "none");
      document.getElementById(targetId).style.display = "block";
    });
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    fetch("http://localhost:3001/api/logout", { method: "POST", credentials: "include" })
      .then(() => window.location.href = "login.html");
  });

  initPatientDashboard();
});
