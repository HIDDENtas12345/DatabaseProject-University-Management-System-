const apiBase = 'http://localhost:3001/api';

// -------------------- Navigation --------------------
document.getElementById('navAppointments').addEventListener('click', () => showSection('appointments'));
document.getElementById('navRegister').addEventListener('click', () => showSection('register'));
document.getElementById('navDoctors').addEventListener('click', () => showSection('doctors'));
document.getElementById('navSchedules').addEventListener('click', () => showSection('schedules'));
document.getElementById('navProfile').addEventListener('click', async() => {showSection('profile'); await loadProfile();});


function showSection(section) {
  const sections = ['appointments','register','doctors','schedules','profile'];
  sections.forEach(s => {
    document.getElementById(s+'Section').style.display = s===section ? 'block' : 'none';
  });
}

// -------------------- Load Data --------------------
async function loadDashboard() {
  await loadAppointments();
  await loadDoctors();
  await loadSchedules();
  await loadStats();
}

// -------------------- Appointments --------------------
async function loadAppointments() {
  const res = await fetch(`${apiBase}/reception/appointments/today`);
  const data = await res.json();
  const tbody = document.querySelector('#appointmentsTable tbody');
  tbody.innerHTML = data.map(a => `
    <tr>
      <td>${a.appointment_time}</td>
      <td>${a.patient_name}</td>
      <td>${a.doctor_name}</td>
      <td>${a.reason}</td>
      <td>
        <select data-id="${a.appointment_id}" class="statusSelect">
          <option value="Waiting" ${a.status==='Waiting'?'selected':''}>Waiting</option>
          <option value="In Progress" ${a.status==='In Progress'?'selected':''}>In Progress</option>
          <option value="Completed" ${a.status==='Completed'?'selected':''}>Completed</option>
          <option value="Cancelled" ${a.status==='Cancelled'?'selected':''}>Cancelled</option>
        </select>
      </td>
      <td><input type="number" data-id="${a.appointment_id}" class="billInput" value="${a.bill_amount || ''}" placeholder="Amount"></td>
      <td>
        <select data-id="${a.appointment_id}" class="billStatus">
          <option value="unpaid" ${a.bill_status==='unpaid'?'selected':''}>Unpaid</option>
          <option value="paid" ${a.bill_status==='paid'?'selected':''}>Paid</option>
          <option value="pending" ${a.bill_status==='pending'?'selected':''}>Pending</option>
        </select>
        <button data-id="${a.appointment_id}" class="updateBtn">Update</button>
      </td>
    </tr>
  `).join('');

  // Add event listeners for update buttons
  document.querySelectorAll('.updateBtn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      const status = document.querySelector(`.statusSelect[data-id="${id}"]`).value;
      const bill_amount = document.querySelector(`.billInput[data-id="${id}"]`).value;
      const bill_status = document.querySelector(`.billStatus[data-id="${id}"]`).value;
      await fetch(`${apiBase}/reception/appointments/${id}/update`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({status, bill_amount, bill_status})
      });
      alert('Updated successfully');
      loadAppointments();
    });
  });
}

// -------------------- Doctors --------------------
async function loadDoctors() {
  const res = await fetch(`${apiBase}/doctors`);
  const data = await res.json();
  const tbody = document.querySelector('#doctorsTable tbody');
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>${d.name}</td>
      <td>${d.specialization}</td>
      <td>${d.qualification}</td>
      <td><img src="${d.photo || '/assets/default-doctor.jpg'}" width="50"></td>
    </tr>
  `).join('');
}

// -------------------- Schedules --------------------
async function loadSchedules() {
  const res = await fetch(`${apiBase}/schedules`);
  const data = await res.json();
  const tbody = document.querySelector('#schedulesTable tbody');
  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${s.doctor_name}</td>
      <td>${s.day}</td>
      <td>${s.start_time}</td>
      <td>${s.end_time}</td>
      <td>${s.room}</td>
    </tr>
  `).join('');
}

// -------------------- Register Patient --------------------
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const obj = Object.fromEntries(formData.entries());
  const res = await fetch(`${apiBase}/reception/patients`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(obj)
  });
  const data = await res.json();
  alert(data.message);
  e.target.reset();
  loadDashboard();
});
async function loadProfile() {
  try {
    const res = await fetch(`${apiBase}/reception/profile`);
    const profile = await res.json();

     document.querySelector('#profileForm [name="name"]').value = profile.name || '';
    document.querySelector('#profileForm [name="email"]').value = profile.email || '';
    document.querySelector('#profileForm [name="phone"]').value = profile.phone || '';
    document.querySelector('#profileForm [name="gender"]').value = profile.gender || '';
    document.querySelector('#profileForm [name="dob"]').value = profile.dob || '';
    document.querySelector('#profileForm [name="address"]').value = profile.address || '';
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

async function saveProfile() {
  const form = document.querySelector('#profileForm');
  const data = {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    gender: form.gender.value,
    dob: form.dob.value,
    address: form.address.value
  };

  try {
    const res = await fetch('/api/reception/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    alert(result.message || 'Profile saved');
  } catch (err) {
    console.error('Error saving profile:', err);
  }
}

// -------------------- Stats --------------------
// Load stats for cards
async function loadStats() {
  try {
    const [appointmentsRes, patientsRes, doctorsRes, schedulesRes] = await Promise.all([
      fetch(`${apiBase}/reception/appointments/today/count`),
      fetch(`${apiBase}/reception/patients/new/count`),
      fetch(`${apiBase}/reception/doctors/count`),
      fetch(`${apiBase}/reception/schedules/count`)
    ]);

    const [appointments, patients, doctors, schedules] = await Promise.all([
      appointmentsRes.json(),
      patientsRes.json(),
      doctorsRes.json(),
      schedulesRes.json()
    ]);

    document.getElementById('todayAppointments').textContent = appointments.total;
    document.getElementById('newPatients').textContent = patients.total;
    document.getElementById('availableDoctors').textContent = doctors.total;
    document.getElementById('scheduledSlots').textContent = schedules.total;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

document.getElementById('logout').addEventListener('click', async () => {
  try {
    // Call backend to destroy session
    await fetch(`${apiBase}/logout`, { method: 'POST' });

    // Redirect to login page
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Logout failed:', err);
    // Still redirect if session clearing fails
    window.location.href = 'login.html';
  }
});

// Initialize dashboard and auto-refresh stats every 1 minute
document.addEventListener('DOMContentLoaded', async () => {
  await loadAppointments();
  await loadDoctors();
  await loadSchedules();
  await loadStats();

  // Auto-refresh cards every 60 seconds
  setInterval(loadStats, 60000);
});
