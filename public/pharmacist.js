const API_URL = "http://localhost:3001/api";
let pharmacistId = null;

async function getLoggedInUser() {
  try {
    const res = await fetch(`${API_URL}/me`, { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "login.html"; // not logged in
      return;
    }

    const user = await res.json();

    if (user.role !== "pharmacist") {
      alert("Access denied! Only pharmacists can use this dashboard.");
      window.location.href = "login.html";
      return;
    }

    pharmacistId = user.id;
    document.querySelector(".admin-profile").innerHTML = `<i class="fas fa-user-circle"></i> ${user.name}`;
  } catch (err) {
    console.error("Failed to fetch logged in user:", err);
    window.location.href = "login.html";
  }
}

// ==================== Load Pharmacist Profile ====================
async function loadProfile() {
  try {
    const res = await fetch(`${API_URL}/pharmacist/profile`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const nameInput = document.getElementById("profileName");
    const emailInput = document.getElementById("profileEmail");
    const phoneInput = document.getElementById("profilePhone");
    const genderInput = document.getElementById("profileGender");
    const dobInput = document.getElementById("profileDob");
    const addressInput = document.getElementById("profileAddress");

    if (nameInput) nameInput.value = data.name || "";
    if (emailInput) emailInput.value = data.email || "";
    if (phoneInput) phoneInput.value = data.phone || "";
    if (genderInput) genderInput.value = data.gender || "Male";
    if (dobInput) dobInput.value = data.dob ? data.dob.split("T")[0] : "";
    if (addressInput) addressInput.value = data.address || "";

  } catch (err) {
    console.error("Failed to load pharmacist profile:", err);
    alert("Failed to load profile. Make sure you are logged in as a pharmacist.");
  }
}

// ==================== Load Expired Medicines ====================
async function loadExpired() {
  try {
    const res = await fetch(`${API_URL}/medicines/expired`, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const expired = await res.json();

    const tableBody = document.querySelector("#expired table tbody");
    if (!tableBody) {
      console.warn("Expired medicines table not found in DOM.");
      return;
    }

    if (!expired.length) {
      tableBody.innerHTML = `<tr><td colspan="4">No expired medicines found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = expired.map(m => `
      <tr>
        <td>${m.medicine_id}</td>
        <td>${m.name}</td>
        <td>${m.expiry_date}</td>
        <td style="color:red;">Expired</td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Failed to load expired medicines:", err);
    const tableBody = document.querySelector("#expired table tbody");
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4">Error loading expired medicines.</td></tr>`;
  }
}


function showEditProfile() {
  showSection("editProfile");
  fetch(`${API_URL}/pharmacist/profile`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      document.getElementById("profileName").value = data.name;
      document.getElementById("profilePhone").value = data.phone || "";
      document.getElementById("profileGender").value = data.gender || "Male";
      document.getElementById("profileDob").value = data.dob ? data.dob.split("T")[0] : "";
      document.getElementById("profileAddress").value = data.address || "";
    });
}
async function updateProfile(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById("profileName").value,
    phone: document.getElementById("profilePhone").value,
    gender: document.getElementById("profileGender").value,
    dob: document.getElementById("profileDob").value,
    address: document.getElementById("profileAddress").value
  };

  try {
    const res = await fetch(`${API_URL}/pharmacist/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    const result = await res.json();
    alert(result.message);
  } catch (err) {
    console.error("Failed to update profile:", err);
  }
}

// Show sections
function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";

  if (id === "medicines") loadMedicines();
  if (id === "prescriptions") loadPrescriptions();
  if (id === "expired") loadExpired();
}
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/pharmacist/dashboard`, { credentials: "include" });
    const stats = await res.json();
    document.getElementById("totalMedicines").innerText = stats.totalMedicines;
    document.getElementById("prescriptionsToday").innerText = stats.prescriptionsToday;
    document.getElementById("lowStock").innerText = stats.lowStock;
    document.getElementById("expiredMeds").innerText = stats.expiredMeds;
  } catch (err) {
    console.error("Failed to load dashboard:", err);
  }
}

// Load Medicines
async function loadMedicines() {
  try {
    const res = await fetch(`${API_URL}/medicines`);
    const medicines = await res.json();

    const table = document.querySelector("#medicines table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th><th>Name</th><th>Category</th><th>Stock</th>
          <th>Price</th><th>Expiry</th><th>Company</th>
        </tr>
      </thead>
      <tbody>
        ${medicines.map(m => `
          <tr>
            <td>${m.medicine_id}</td>
            <td>${m.name}</td>
            <td>${m.category}</td>
            <td>${m.quantity}</td>
            <td>${m.price}</td>
            <td>${m.expiry_date}</td>
            <td>${m.company}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
  } catch (err) {
    console.error("Failed to load medicines:", err);
  }
}

// Add Medicine
const manageForm = document.querySelector("#manage form");
if (manageForm) {
  manageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const medicine = {
      name: form[0].value,
      category: form[1].value,
      quantity: form[2].value,
      price: form[3].value,
      expiry_date: form[4].value,
      company: form[5].value,        // company from input
      added_by: pharmacistId          // pharmacist ID
    };

    try {
      await fetch(`${API_URL}/medicines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(medicine)
      });
      alert("Medicine added!");
      form.reset();
      showSection("medicines"); // show medicines section
    } catch (err) {
      console.error("Failed to add medicine:", err);
      alert("Error adding medicine!");
    }
  });
}


// Load Prescriptions
async function loadPrescriptions() {
  try {
    const res = await fetch(`${API_URL}/prescriptions`);
    const prescriptions = await res.json();

    const table = document.querySelector("#prescriptions table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th><th>Doctor</th><th>Patient</th>
          <th>Date</th><th>Diagnosis</th><th>Medicines</th>
        </tr>
      </thead>
      <tbody>
        ${prescriptions.map(p => `
          <tr>
            <td>${p.prescription_id}</td>
            <td>${p.doctor_name || p.doctor_id}</td>
            <td>${p.patient_name || p.patient_id}</td>
            <td>${p.prescription_date}</td>
            <td>${p.diagnosis}</td>
            <td>${p.medicines}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
  } catch (err) {
    console.error("Failed to load prescriptions:", err);
  }
}

// Load Expired Medicines
// Load default section on page load
document.addEventListener("DOMContentLoaded", async () => {
  await getLoggedInUser();
  showSection("dashboard");
  loadDashboard();
  loadProfile();
});

