document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('appointmentForm');
  const formMsg = document.getElementById('formMsg');
  const appointmentsTableBody = document.getElementById('appointmentsTableBody');

  // 👉 1. Handle form submission to add appointment
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = {
      doctor_id: formData.get('doctor_id'),
      patient_id: formData.get('patient_id'),
      receptionsist_id:formData.get('receptionsist_id'),
      appointment_time: formData.get('appointment_time'),
      reason: formData.get('reason')
    };

    try {
      const res = await fetch('/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const msg = await res.text();
      formMsg.textContent = msg;
      formMsg.style.color = res.ok ? 'green' : 'red';

      if (res.ok) {
        form.reset();
        loadAppointments();
      }
    } catch (err) {
      console.error(err);
      formMsg.textContent = 'Error adding appointment.';
      formMsg.style.color = 'red';
    }
  });

  // 👉 2. Load today’s appointments
  async function loadAppointments() {
    try {
      const res = await fetch('/appointments/all'); // backend route to get today's appointments
      const appointments = await res.json();

      appointmentsTableBody.innerHTML = ''; // Clear previous rows

      if (appointments.length === 0) {
        appointmentsTableBody.innerHTML = '<tr><td colspan="5">No appointments today.</td></tr>';
        return;
      }

      appointments.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${new Date(app.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${app.patient_name}</td>
          <td>${app.doctor_name}</td>
          <td>${app.receptionsist_name}</td>
          <td>${app.reason}</td>
          <td>${app.status}</td>
        `;
        appointmentsTableBody.appendChild(row);
      });
    } catch (err) {
      console.error('Error loading appointments:', err);
      appointmentsTableBody.innerHTML = '<tr><td colspan="5">Error loading appointments.</td></tr>';
    }
  }

  // Load appointments on page load
  loadAppointments();
});
