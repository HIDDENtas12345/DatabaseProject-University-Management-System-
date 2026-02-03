document.addEventListener("DOMContentLoaded", () => {
  // Default show Tasks section
  showSection("tasks");

  // Load Manual Dashboard Data
  loadDashboard();

  // Navigation handling
  document.getElementById("navTasks").addEventListener("click", () => showSection("tasks"));
  document.getElementById("navDuty").addEventListener("click", () => showSection("duty"));
  document.getElementById("navAnnouncements").addEventListener("click", () => showSection("announcementsSection"));
  document.getElementById("navContact").addEventListener("click", () => showSection("contact"));
  document.getElementById("navProfile").addEventListener("click", () => showSection("profile"));
});

// ---------------- Show Only One Section ----------------
function showSection(id) {
  document.querySelectorAll(".section").forEach(sec => sec.style.display = "none");
  document.getElementById(id).style.display = "block";
}

// ---------------- Manual Dashboard ----------------
function loadDashboard() {
  // Sample manual data (you can edit these)
  const todayDuty = "Morning Shift (8 AM - 2 PM)";
  const tasks = [
    { title: "Check patient reports", status: "Pending" },
    { title: "Assist in Ward 3", status: "Completed" },
    { title: "Inventory update", status: "Pending" }
  ];
  const announcements = [
    "Staff meeting at 4 PM.",
    "Update on hospital SOPs.",
    "Safety drill scheduled tomorrow."
  ];

  // Update summary cards
  document.getElementById("todayDuty").innerText = todayDuty;
  document.getElementById("pendingTasks").innerText = tasks.filter(t => t.status === "Pending").length;
  document.getElementById("announcements").innerText = announcements.length;
  document.getElementById("adminMessages").innerText = 1; // Example value

  // Render tasks
  const taskList = document.getElementById("tasksList");
  taskList.innerHTML = "";
  tasks.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.title} - ${t.status}`;
    li.style.color = t.status === "Pending" ? "red" : "green";
    taskList.appendChild(li);
  });

  // Render duty schedule manually
  const duties = [
    { date: "2025-10-26", shift: "Morning", dept: "Emergency", role: "Support Staff" },
    { date: "2025-10-27", shift: "Evening", dept: "Pharmacy", role: "Assistant" }
  ];
  const tbody = document.getElementById("dutyTableBody");
  tbody.innerHTML = "";
  duties.forEach(d => {
    const row = `<tr>
      <td>${d.date}</td>
      <td>${d.shift}</td>
      <td>${d.dept}</td>
      <td>${d.role}</td>
    </tr>`;
    tbody.innerHTML += row;
  });

  // Render announcements manually
  const annSection = document.getElementById("announcementsSection");
  annSection.innerHTML = "<h2>Announcements</h2>";
  announcements.forEach(a => {
    const div = document.createElement("div");
    div.textContent = `📢 ${a}`;
    div.classList.add("announcement");
    annSection.appendChild(div);
  });
}
