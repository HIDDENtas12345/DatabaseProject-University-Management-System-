// ==================== Session Check ====================
async function checkSession() {
  try {
    const res = await fetch('http://localhost:3001/doctor/profile', { credentials: 'include' });
    if (res.status === 401) {
      window.location.href = 'login.html';
      return null;
    }
    const doctor = await res.json();
    populateSidebar(doctor);
    populateViewProfile(doctor);
    populateEditProfileForm(doctor);
    return doctor;
  } catch {
    window.location.href = 'login.html';
    return null;
  }
}

// ==================== Sidebar ====================
function populateSidebar(doctor) {
  document.getElementById('doctorName').innerText = doctor.name || 'Dr. Name';
  document.getElementById('doctorQualification').innerText = doctor.qualification || '';
  document.getElementById('doctorPhoto').src = doctor.photo || '/default-doctor.jpg';
}

// ==================== View Profile ====================
function populateViewProfile(doctor) {
  document.getElementById('view_name').innerText = doctor.name || '';
  document.getElementById('view_email').innerText = doctor.email || '';
  document.getElementById('view_phone').innerText = doctor.phone || '';
  document.getElementById('view_address').innerText = doctor.address || '';
  document.getElementById('view_gender').innerText = doctor.gender || '';
  document.getElementById('view_dob').innerText = doctor.dob || '';
  document.getElementById('view_photo').src = doctor.photo || '/default-doctor.jpg';
}

// ==================== Edit Profile ====================
function populateEditProfileForm(doctor) {
  document.getElementById('specialization').value = doctor.specialization || '';
  document.getElementById('qualification').value = doctor.qualification || '';
  document.getElementById('available_days').value = doctor.available_days || '';
  document.getElementById('timings').value = doctor.timings || '';
  document.getElementById('room_number').value = doctor.room_number || '';
}

// ==================== Logout ====================
function logout() {
  fetch('http://localhost:3001/logout', { credentials: 'include' })
    .finally(() => window.location.href = 'login.html');
}

// ==================== Section Toggle ====================
function showDashboard() {
  document.getElementById('dashboardSection').classList.remove('hidden');
  document.getElementById('profileSection').classList.add('hidden');
}

function toggleProfileView() {
  document.getElementById('dashboardSection').classList.add('hidden');
  document.getElementById('profileSection').classList.remove('hidden');
  document.getElementById('profileDisplay').classList.remove('hidden');
  document.getElementById('profileForm').classList.add('hidden');
}

function showEditForm() {
  document.getElementById('profileDisplay').classList.add('hidden');
  document.getElementById('profileForm').classList.remove('hidden');
}

// ==================== Prescription Modal ====================
function openPrescriptionForm(appointmentId, patientName) {
  document.getElementById('prescriptionModal').classList.remove('hidden');
  document.getElementById('appointmentId').value = appointmentId;
  document.getElementById('prescriptionModalTitle').innerText = `New Prescription for ${patientName}`;
}

function closePrescriptionForm() {
  document.getElementById('prescriptionModal').classList.add('hidden');
}

// ==================== Lab Test Modal ====================
function openLabTestForm(patientId, patientName) {
  const modal = document.getElementById('labTestModal');
  if (!modal) return;
  document.getElementById('labTestPatientId').value = patientId;
  document.getElementById('labTestModalTitle').innerText = `Request Lab Test for ${patientName}`;
  modal.classList.remove('hidden');
}

function closeLabTestForm() {
  document.getElementById('labTestModal').classList.add('hidden');
}

// ==================== Fetch Helper ====================
async function fetchData(url, targetId, templateFn, emptyMsg) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json();
    const container = document.getElementById(targetId);
    if (!container) return;
    container.innerHTML = data.length
      ? data.map(templateFn).join('')
      : `<p>${emptyMsg}</p>`;
  } catch {
    const container = document.getElementById(targetId);
    if (container) container.innerHTML = `<p>Error loading data</p>`;
  }
}

// ==================== Load Lab Test Types ====================
// ==================== Load Lab Test Types ====================
async function loadLabTestTypes() {
  const select = document.getElementById('labTestType');
  if (!select) return;

  select.innerHTML = '<option value="">Loading...</option>';

  try {
    const res = await fetch('http://localhost:3001/doctor/lab-test-types', { credentials: 'include' });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const types = await res.json();

    if (!Array.isArray(types)) throw new Error("Expected array from server");

    select.innerHTML = '<option value="">Select Test</option>'; // reset

    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.type_id;
      opt.textContent = t.type_name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load lab test types:", err);
    select.innerHTML = '<option value="">Failed to load lab tests</option>';
  }
}

// ==================== Load Dashboard Data ====================
async function loadDashboardData() {
  const doctor = await checkSession();
  if (!doctor) return;

  const prescriptionsContainer = document.getElementById('prescriptionsContainer');
  const labTestsContainer = document.getElementById('labTestsContainer');
  if (prescriptionsContainer) prescriptionsContainer.innerHTML = '';
  if (labTestsContainer) labTestsContainer.innerHTML = '';

  let appointments = [];
  try {
    const res = await fetch('http://localhost:3001/doctor/appointments/today', { credentials: 'include' });
    appointments = await res.json();

    const tbody = document.querySelector('#appointmentsTable tbody');
    tbody.innerHTML = appointments.length
      ? appointments.map(a => `
          <tr id="appointment-${a.appointment_id}">
            <td>${a.appointment_time}</td>
            <td>${a.patient_name}</td>
            <td>${a.reason}</td>
            <td>
              <select onchange="updateAppointment(${a.appointment_id}, this.value)">
                <option value="pending" ${a.status==='pending'?'selected':''}>Pending</option>
                <option value="completed" ${a.status==='completed'?'selected':''}>Completed</option>
                <option value="Cancelled" ${a.status==='Cancelled'?'selected':''}>Cancelled</option>
              </select>
            </td>
            <td>
              <button onclick="updateAppointment(${a.appointment_id}, document.querySelector('#appointment-${a.appointment_id} select').value)">Update</button>
              ${a.status === 'pending' ? `<button onclick="openPrescriptionForm(${a.appointment_id}, '${a.patient_name}')">Prescribe</button>` : ''}
              <button onclick="openLabTestForm(${a.patient_id}, '${a.patient_name}')">Lab Test</button>
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="5">No assigned patients today.</td></tr>`;

  } catch (err) {
    console.error(err);
    document.querySelector('#appointmentsTable tbody').innerHTML = `<tr><td colspan="5">Error loading appointments</td></tr>`;
  }

  // Past Prescriptions & Lab Tests
  const processedPatients = new Set();
  appointments.forEach(a => {
    const pid = a.patient_id;
    const pname = a.patient_name;
    if (!pid || processedPatients.has(pid)) return;
    processedPatients.add(pid);

    if (prescriptionsContainer) {
      const presDiv = document.createElement('div');
      presDiv.id = `prescriptionsList-${pid}`;
      presDiv.classList.add('patient-prescriptions');
      presDiv.innerHTML = `<h4>Past Prescriptions for ${pname}</h4>`;
      prescriptionsContainer.appendChild(presDiv);
      fetchData(
        `http://localhost:3001/doctor/patient/${pid}/prescriptions`,
        presDiv.id,
        pr => `<p>💊 <strong>${pr.patient_name}</strong>: ${pr.diagnosis} — <em>${pr.medications}</em> (${pr.date})</p>`,
        'No past prescriptions.'
      );
    }

    if (labTestsContainer) {
      const labDiv = document.createElement('div');
      labDiv.id = `labTestsList-${pid}`;
      labDiv.classList.add('patient-lab-tests');
      labDiv.innerHTML = `<h4>Lab Tests for ${pname}</h4>`;
      labTestsContainer.appendChild(labDiv);
      fetchData(
        `http://localhost:3001/doctor/patient/${pid}/lab-tests`,
        labDiv.id,
        t => `<p>🧪 <strong>${t.test_type}</strong>: ${t.result || 'Pending'}</p>`,
        'No lab tests for this patient.'
      );
    }
  });
}

// ==================== Update Appointment ====================
async function updateAppointment(appointment_id, status) {
  try {
    const res = await fetch('http://localhost:3001/doctor/appointments/update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id, status })
    });
    const data = await res.json();
    alert(res.ok ? `✅ ${data.message}` : `❌ ${data.message}`);
    loadDashboardData();
  } catch (err) {
    console.error(err);
    alert('Failed to update appointment.');
  }
}

// ==================== DOM Loaded ====================
document.addEventListener('DOMContentLoaded', async () => {
  // 1️⃣ Check session
  const doctor = await checkSession();
  if (!doctor) return;

  // 2️⃣ Load lab test types once
  await loadLabTestTypes();

  // 3️⃣ Button listeners
  document.getElementById('dashboardBtn').addEventListener('click', showDashboard);
  document.getElementById('viewProfileBtn').addEventListener('click', toggleProfileView);
  document.querySelector('.logout-btn').addEventListener('click', logout);
  document.getElementById('editProfileBtn').addEventListener('click', showEditForm);

  // 4️⃣ Load dashboard data
  await loadDashboardData();

  // 5️⃣ Profile form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async e => {
      e.preventDefault();
      const formData = new FormData(profileForm);
      try {
        const res = await fetch('http://localhost:3001/doctor/profile', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        alert(await res.text());
        if (res.ok) {
          const updatedDoctor = await checkSession();
          document.getElementById('doctorQualification').innerText = updatedDoctor.qualification || '';
          document.getElementById('doctorPhoto').src = updatedDoctor.photo || '/default-doctor.jpg';
          toggleProfileView();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to update profile.');
      }
    });
  }

  // 6️⃣ Prescription form submission
  const prescriptionForm = document.getElementById('prescriptionForm');
  if (prescriptionForm) {
    prescriptionForm.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(prescriptionForm).entries());
      try {
        const res = await fetch('http://localhost:3001/doctor/prescriptions/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          alert('✅ Prescription created!');
          closePrescriptionForm();
          await loadDashboardData();
        } else alert('❌ ' + data.message);
      } catch (err) {
        console.error(err);
        alert('Error creating prescription.');
      }
    });
  }

  // 7️⃣ Lab test form submission
  const labTestForm = document.getElementById('labTestForm');
  if (labTestForm) {
    labTestForm.addEventListener('submit', async e => {
      e.preventDefault();

      const patient_id = document.getElementById('labTestPatientId')?.value;
      const type_id = labTestForm.querySelector('select[name="type_id"]').value;
      const notes = labTestForm.querySelector('textarea[name="notes"]').value.trim();

      if (!patient_id || !type_id) {
        alert('❌ Please select patient and lab test type.');
        return;
      }

      try {
        const res = await fetch('http://localhost:3001/doctor/lab-tests/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patient_id, type_id, notes })
        });
        const data = await res.json();
        if (res.ok) {
          alert('✅ Lab test requested!');
          closeLabTestForm();
          await loadDashboardData();
        } else {
          alert('❌ ' + (data.message || 'Failed to request lab test'));
        }
      } catch (err) {
        console.error(err);
        alert('❌ Error creating lab test.');
      }
    });
  }


  loadDashboardData();
});
