const apiBase = 'http://localhost:3001/api/admin';

// -------------------- API Helper --------------------
async function api(url, opts = {}) {
  try {
    const res = await fetch(url, { credentials: "include", ...opts });
    if (!res.ok) {
      console.error(`API error ${res.status}: ${res.statusText}`);
      return null;
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : null;
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

// -------------------- Navigation --------------------
document.querySelectorAll(".sidebar ul li a").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const section = link.id.replace("nav", "").toLowerCase();
    showSection(section);
  });
});

function hideAllSections() {
  document.querySelectorAll(".section").forEach(sec => sec.style.display = "none");
}

function showSection(section) {
  hideAllSections();
  const el = document.getElementById(section + "Section");
  if (!el) return;
  el.style.display = "block";

  // Load section-specific data
  if (section === "patients") loadPatients();
  if (section === "appointments") loadAllAppointments();
}

// -------------------- Dashboard --------------------
async function loadDashboard() {
  try {
    const data = await api(`${apiBase}/dashboard`);
    if (!data) return;

    document.getElementById('totalDoctors').textContent = data.totalDoctors || 0;
    document.getElementById('totalPatients').textContent = data.totalPatients || 0;
    document.getElementById('totalAppointments').textContent = data.totalAppointments || 0;
    document.getElementById('totalStaff').textContent = data.totalStaff || 0;

    // Fetch tables
    const [doctors, staff, tasks, duties, announcements] = await Promise.all([
      api(`${apiBase}/doctors`),
      api(`${apiBase}/staff`),
      api(`${apiBase}/tasks`),
      api(`${apiBase}/duties`),
      api(`${apiBase}/announcements`)
    ]);

    if (doctors) populateDoctorsTable(doctors);
    if (staff) {
      populateStaffTable(staff);
      populateStaffDropdowns(staff);
    }
    if (tasks) populateTasksTable(tasks);
    if (duties) populateDutyTable(duties);
    if (announcements) populateAnnouncements(announcements);

  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

// -------------------- Populate Tables --------------------
function populateDoctorsTable(doctors) {
  const tbody = document.querySelector('#doctorsTable tbody');
  tbody.innerHTML = doctors.map(d => `
    <tr>
      <td>${d.name}</td>
      <td>${d.specialization}</td>
      <td>${d.qualification}</td>
      <td>${d.available_days}</td>
      <td>${d.timings}</td>
      <td>${d.room_number}</td>
      <td>
        <button class="deleteDoctor" data-id="${d.user_id}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.deleteDoctor').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      if (!confirm("Delete this doctor?")) return;
      await api(`${apiBase}/doctors/${id}`, { method: 'DELETE' });
      loadDashboard();
    });
  });
}

function populateStaffTable(staff) {
  const tbody = document.querySelector('#staffTable tbody');
  tbody.innerHTML = staff.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.position}</td>
      <td>${s.shift}</td>
      <td>${s.department}</td>
      <td>${s.email}</td>
      <td>${s.phone}</td>
      <td>
        <button class="deleteStaff" data-id="${s.user_id}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.deleteStaff').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.target.dataset.id;
      if (!confirm("Delete this staff?")) return;
      await api(`${apiBase}/staff/${id}`, { method: 'DELETE' });
      loadDashboard();
    });
  });
}

function populateTasksTable(tasks) {
  const tbody = document.querySelector('#tasksTable tbody');
  tbody.innerHTML = tasks.map(t => `
    <tr>
      <td>${t.staff_name}</td>
      <td>${t.task_name}</td>
      <td>${t.deadline || '-'}</td>
      <td>${t.status || '-'}</td>
    </tr>
  `).join('');
}

function populateDutyTable(duties) {
  const tbody = document.querySelector('#dutyTable tbody');
  tbody.innerHTML = duties.map(d => `
    <tr>
      <td>${d.staff_name}</td>
      <td>${d.duty_date}</td>
      <td>${d.shift}</td>
      <td>${d.department}</td>
      <td>${d.role_assigned}</td>
    </tr>
  `).join('');
}

function populateAnnouncements(announcements) {
  const ul = document.getElementById('announcementList');
  ul.innerHTML = announcements.map(a => `<li><b>${a.title}</b>: ${a.content}</li>`).join('');
}

function populateStaffDropdowns(staff) {
  document.querySelectorAll('select[name="user_id"]').forEach(select => {
    select.innerHTML = '<option value="">Select Staff</option>';
    staff.forEach(s => {
      select.innerHTML += `<option value="${s.user_id}">${s.name}</option>`;
    });
  });
}

// -------------------- Patients --------------------
async function loadPatients() {
  const tbody = document.querySelector("#patientsTable tbody");
  if (!tbody) return;
  const data = await api(`${apiBase}/patients`);
  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>No patients found.</td></tr>";
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.email}</td>
      <td>${p.phone || '-'}</td>
      <td>${p.gender || '-'}</td>
      <td>${p.dob ? new Date(p.dob).toLocaleDateString() : '-'}</td>
      <td>${p.address || '-'}</td>
    </tr>
  `).join('');
}

// -------------------- Appointments --------------------
// -------------------- Profile --------------------
async function loadProfile() {
  const res = await api(`${apiBase}/profile`);
  if (!res) return;

  document.getElementById("adminName").textContent = res.name || "Admin";
  if(document.getElementById("profileName")) document.getElementById("profileName").value = res.name || '';
  if(document.getElementById("profileEmail")) document.getElementById("profileEmail").value = res.email || '';
  if(document.getElementById("profilePhone")) document.getElementById("profilePhone").value = res.phone || '';
  if(document.getElementById("profileAddress")) document.getElementById("profileAddress").value = res.address || '';
}

document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/profile`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(obj)
  });
  if(data) alert(data.message || "Profile updated");
  loadProfile();
});

// -------------------- Add / Submit Forms --------------------
document.getElementById('doctorForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/doctors`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj)
  });
  if(data) alert(data.message || "Doctor added");
  e.target.reset();
  loadDashboard();
});

document.getElementById('staffForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/staff`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj)
  });
  if(data) alert(data.message || "Staff added");
  e.target.reset();
  loadDashboard();
});

document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/tasks`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj) });
  if(data) alert(data.message || "Task assigned");
  e.target.reset();
  loadDashboard();
});

document.getElementById('dutyForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/duties`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj) });
  if(data) alert(data.message || "Duty assigned");
  e.target.reset();
  loadDashboard();
});

document.getElementById('announcementForm').addEventListener('submit', async e => {
  e.preventDefault();
  const obj = Object.fromEntries(new FormData(e.target).entries());
  const data = await api(`${apiBase}/announcements`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(obj) });
  if(data) alert(data.message || "Announcement posted");
  e.target.reset();
  loadDashboard();
});

// -------------------- Show / Hide Add Forms --------------------
document.getElementById('addDoctorBtn').addEventListener('click', () => {
  const f = document.getElementById('doctorForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('addStaffBtn').addEventListener('click', () => {
  const f = document.getElementById('staffForm');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
});

// -------------------- Init --------------------
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadProfile();
});
