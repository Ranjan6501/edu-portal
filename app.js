/* ═══════════════════════════════════════════════════
   EduPortal — Student Registration & Enrollment System
   app.js — Firebase Auth + Firestore simulation
   + GitHub + Vercel integration references
═══════════════════════════════════════════════════ */

// ─── Firebase Configuration (Demo/Simulation) ─────
// In production, replace with your actual Firebase config
// imported from: https://console.firebase.google.com/
const FIREBASE_CONFIG = {
  projectId: "edu-portal-demo",
  authDomain: "edu-portal-demo.firebaseapp.com",
  storageBucket: "edu-portal-demo.appspot.com",
};

// Deployment info
const DEPLOYMENT = {
  platform: "Vercel",
  repoUrl: "https://github.com/your-org/edu-portal",
  liveUrl:  "https://edu-portal.vercel.app",
};

// ─── Demo Data Store (simulates Firestore) ─────────
const DB = {
  students: [
    { id: "STU-2024-001", name: "Jane Smith",   email: "jane.smith@university.edu",   program: "B.Sc. Computer Science" },
    { id: "STU-2024-002", name: "Carlos Reyes", email: "c.reyes@university.edu",       program: "B.Eng. Software Eng." },
    { id: "STU-2024-003", name: "Amara Osei",   email: "a.osei@university.edu",        program: "B.Sc. Information Tech." },
    { id: "STU-2024-004", name: "Liu Wei",      email: "liu.wei@university.edu",       program: "B.Sc. Data Science" },
    { id: "STU-2024-005", name: "Priya Nair",   email: "p.nair@university.edu",        program: "B.Sc. Computer Science" },
  ],

  courses: [
    { code: "CS101", name: "Intro to Computer Science", credits: 3, capacity: 40, enrolled: 38, prereq: "None", dept: "CS" },
    { code: "CS301", name: "Data Structures & Algorithms", credits: 4, capacity: 35, enrolled: 31, prereq: "CS101", dept: "CS" },
    { code: "CS401", name: "Software Engineering", credits: 3, capacity: 30, enrolled: 27, prereq: "CS301", dept: "CS" },
    { code: "MATH101", name: "Calculus I", credits: 4, capacity: 50, enrolled: 45, prereq: "None", dept: "MATH" },
    { code: "MATH301", name: "Calculus III", credits: 4, capacity: 35, enrolled: 20, prereq: "MATH101", dept: "MATH" },
    { code: "ENG201", name: "Technical Writing", credits: 2, capacity: 25, enrolled: 10, prereq: "None", dept: "ENG" },
    { code: "PHY101", name: "Physics I", credits: 3, capacity: 45, enrolled: 40, prereq: "MATH101", dept: "PHYS" },
    { code: "CS201", name: "Database Systems", credits: 3, capacity: 30, enrolled: 30, prereq: "CS101", dept: "CS" },
    { code: "CS501", name: "Machine Learning", credits: 4, capacity: 25, enrolled: 12, prereq: "CS301, MATH301", dept: "CS" },
    { code: "NET101", name: "Computer Networks", credits: 3, capacity: 30, enrolled: 18, prereq: "CS101", dept: "NET" },
    { code: "SEC401", name: "Cybersecurity Fundamentals", credits: 3, capacity: 20, enrolled: 19, prereq: "CS301", dept: "SEC" },
    { code: "WEB201", name: "Web Development", credits: 3, capacity: 35, enrolled: 22, prereq: "CS101", dept: "CS" },
  ],

  enrollments: [
    { id: 1, student: "Jane Smith",   sid: "STU-2024-001", course: "CS401", code: "CS401", status: "pending",  date: "Jan 15" },
    { id: 2, student: "Carlos Reyes", sid: "STU-2024-002", course: "MATH301", code: "MATH301", status: "pending",  date: "Jan 14" },
    { id: 3, student: "Amara Osei",   sid: "STU-2024-003", course: "CS501", code: "CS501",  status: "pending",  date: "Jan 13" },
    { id: 4, student: "Liu Wei",      sid: "STU-2024-004", course: "ENG201", code: "ENG201", status: "approved", date: "Jan 12" },
    { id: 5, student: "Priya Nair",   sid: "STU-2024-005", course: "PHY101", code: "PHY101", status: "approved", date: "Jan 11" },
    { id: 6, student: "Jane Smith",   sid: "STU-2024-001", course: "WEB201", code: "WEB201", status: "rejected", date: "Jan 10" },
  ],

  // Demo auth credentials
  users: {
    students: { "student@edu.com": { pass: "student123", name: "Jane Smith", initials: "JS" } },
    admins:   { "admin@edu.com":   { pass: "admin123" } }
  }
};

// ─── State ─────────────────────────────────────────
let currentUser = null;
let currentRole = null;

// ─── Init ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  setDates();
  renderCourses();
  renderStudentsTable();
  renderCoursesTable();
  renderEnrollmentsTable();
  renderApprovalList();
});

function setDates() {
  const d = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const el1 = document.getElementById("dash-date");
  const el2 = document.getElementById("admin-dash-date");
  if (el1) el1.textContent = d;
  if (el2) el2.textContent = d;
}

// ─── Navigation ────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(pageId);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);
}

function showSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function showTab(tabId, navClass) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add("active");

  document.querySelectorAll("." + navClass).forEach(a => a.classList.remove("active"));
  event.currentTarget.classList.add("active");
}

function toggleMenu() {
  // Mobile nav — simple alert for demo
  showToast("Navigation menu (responsive sidebar in production)");
}

// ─── Auth Flows ────────────────────────────────────
function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-pass").value;
  const errEl = document.getElementById("login-error");

  // Firebase Auth simulation
  const isDemo = (email === "student@edu.com" && pass === "student123")
              || (email === "STU-2024-001" && pass === "student123");

  if (isDemo) {
    currentUser = { name: "Jane Smith", initials: "JS", email: "jane.smith@university.edu", sid: "STU-2024-001" };
    currentRole = "student";
    errEl.classList.add("hidden");
    document.getElementById("student-greeting").textContent = "Welcome back, Jane! 👋";
    document.getElementById("student-avatar").textContent = "JS";
    document.getElementById("profile-avatar-lg").textContent = "JS";
    showPage("page-student-dashboard");
    showToast("✓ Signed in successfully — Firebase Auth");
  } else {
    errEl.textContent = "Invalid credentials. Demo: student@edu.com / student123";
    errEl.classList.remove("hidden");
  }
}

function doRegister() {
  const fname = document.getElementById("reg-fname").value.trim();
  const lname = document.getElementById("reg-lname").value.trim();
  const sid   = document.getElementById("reg-sid").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass  = document.getElementById("reg-pass").value;
  const errEl = document.getElementById("reg-error");

  if (!fname || !lname || !sid || !email || !pass) {
    errEl.textContent = "Please fill in all fields.";
    errEl.classList.remove("hidden");
    return;
  }
  if (pass.length < 8) {
    errEl.textContent = "Password must be at least 8 characters.";
    errEl.classList.remove("hidden");
    return;
  }

  // Simulate Firebase createUserWithEmailAndPassword
  const initials = (fname[0] + lname[0]).toUpperCase();
  currentUser = { name: `${fname} ${lname}`, initials, email, sid };
  currentRole = "student";
  errEl.classList.add("hidden");

  // Push to DB
  DB.students.push({ id: sid, name: `${fname} ${lname}`, email, program: "Undeclared" });

  document.getElementById("student-greeting").textContent = `Welcome, ${fname}! 👋`;
  document.getElementById("student-avatar").textContent = initials;
  document.getElementById("profile-avatar-lg").textContent = initials;
  document.getElementById("prof-fname").value = fname;
  document.getElementById("prof-lname").value = lname;
  document.getElementById("prof-sid").value = sid;
  document.getElementById("prof-email").value = email;

  showPage("page-student-dashboard");
  showToast("✓ Account created — saved to Firebase Firestore");
}

function doAdminLogin() {
  const email = document.getElementById("admin-email").value.trim();
  const pass  = document.getElementById("admin-pass").value;
  const errEl = document.getElementById("admin-error");

  if (email === "admin@edu.com" && pass === "admin123") {
    currentUser = { name: "Administrator", initials: "AD" };
    currentRole = "admin";
    errEl.classList.add("hidden");
    showPage("page-admin-dashboard");
    showToast("✓ Admin signed in — Firebase Auth (role: admin)");
  } else {
    errEl.textContent = "Invalid credentials. Demo: admin@edu.com / admin123";
    errEl.classList.remove("hidden");
  }
}

function logout() {
  currentUser = null;
  currentRole = null;
  showPage("page-landing");
  showToast("Signed out successfully");
}

// ─── Student: Courses ──────────────────────────────
function renderCourses(filter = "") {
  const grid = document.getElementById("courses-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = DB.courses.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.code.toLowerCase().includes(filter.toLowerCase()) ||
    c.dept.toLowerCase().includes(filter.toLowerCase())
  );

  filtered.forEach(c => {
    const pct = Math.round((c.enrolled / c.capacity) * 100);
    const capClass = pct >= 100 ? "cap-full" : pct >= 80 ? "cap-warn" : "cap-ok";
    const isFull = c.enrolled >= c.capacity;

    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <div class="course-code">${c.code}</div>
      <div class="course-name">${c.name}</div>
      <div class="course-meta">
        <span>📖 ${c.credits} credits</span>
        <span>👥 ${c.enrolled}/${c.capacity}</span>
      </div>
      <div class="capacity-bar"><div class="capacity-fill ${capClass}" style="width:${Math.min(pct,100)}%"></div></div>
      <span class="course-tag">${c.dept}</span>
      ${c.prereq !== "None" ? `<span class="course-tag">Prereq: ${c.prereq}</span>` : ""}
      <br/><br/>
      <button class="btn-primary small" ${isFull ? "disabled" : ""} onclick="enrollCourse('${c.code}','${c.name}')">
        ${isFull ? "Course Full" : "Enroll"}
      </button>
    `;
    grid.appendChild(card);
  });
}

function filterCourses(val) {
  renderCourses(val);
}

function enrollCourse(code, name) {
  // Simulate prerequisite check + Firestore write
  const alreadyEnrolled = DB.enrollments.some(e =>
    e.sid === (currentUser?.sid || "STU-2024-001") && e.code === code
  );
  if (alreadyEnrolled) {
    showToast("⚠ Already enrolled in " + code);
    return;
  }
  DB.enrollments.push({
    id: DB.enrollments.length + 1,
    student: currentUser?.name || "Jane Smith",
    sid: currentUser?.sid || "STU-2024-001",
    course: name, code, status: "pending", date: "Today"
  });
  showToast(`✓ Enrollment request submitted for ${code}`);
}

// ─── Student: Profile ──────────────────────────────
function saveProfile() {
  // Simulate Firestore updateDoc
  const successEl = document.getElementById("profile-success");
  successEl.classList.remove("hidden");
  setTimeout(() => successEl.classList.add("hidden"), 3000);
  showToast("✓ Profile updated in Firebase Firestore");
}

// ─── Admin: Students ──────────────────────────────
function renderStudentsTable() {
  const tbody = document.getElementById("students-tbody");
  if (!tbody) return;
  tbody.innerHTML = DB.students.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.id}</td>
      <td>${s.email}</td>
      <td>${s.program}</td>
      <td>
        <button class="action-btn" onclick="editStudent('${s.id}')">Edit</button>
        <button class="action-btn danger" onclick="deleteStudent('${s.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

function editStudent(sid) {
  const s = DB.students.find(x => x.id === sid);
  if (!s) return;
  document.getElementById("modal-content").innerHTML = `
    <h3>Edit Student</h3>
    <div class="form-group"><label>Name</label><input type="text" id="edit-name" value="${s.name}"/></div>
    <div class="form-group"><label>Email</label><input type="email" id="edit-email" value="${s.email}"/></div>
    <div class="form-group"><label>Program</label><input type="text" id="edit-prog" value="${s.program}"/></div>
    <button class="btn-primary full" onclick="saveStudent('${sid}')">Save Changes</button>
  `;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function saveStudent(sid) {
  const s = DB.students.find(x => x.id === sid);
  s.name    = document.getElementById("edit-name").value;
  s.email   = document.getElementById("edit-email").value;
  s.program = document.getElementById("edit-prog").value;
  closeModal();
  renderStudentsTable();
  showToast("✓ Student record updated — Firestore write");
}

function deleteStudent(sid) {
  DB.students = DB.students.filter(x => x.id !== sid);
  renderStudentsTable();
  showToast("Student record deleted");
}

function openAddStudent() {
  document.getElementById("modal-content").innerHTML = `
    <h3>Add New Student</h3>
    <div class="form-row">
      <div class="form-group"><label>First Name</label><input type="text" id="ns-fname" placeholder="Jane"/></div>
      <div class="form-group"><label>Last Name</label><input type="text" id="ns-lname" placeholder="Doe"/></div>
    </div>
    <div class="form-group"><label>Student ID</label><input type="text" id="ns-sid" placeholder="STU-2025-006"/></div>
    <div class="form-group"><label>Email</label><input type="email" id="ns-email" placeholder="student@university.edu"/></div>
    <div class="form-group"><label>Program</label><input type="text" id="ns-prog" placeholder="B.Sc. Computer Science"/></div>
    <button class="btn-primary full" onclick="addStudent()">Add Student</button>
  `;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function addStudent() {
  const sid = document.getElementById("ns-sid").value.trim();
  if (!sid) { showToast("Student ID is required"); return; }
  DB.students.push({
    id: sid,
    name: `${document.getElementById("ns-fname").value} ${document.getElementById("ns-lname").value}`,
    email: document.getElementById("ns-email").value,
    program: document.getElementById("ns-prog").value
  });
  closeModal();
  renderStudentsTable();
  showToast("✓ Student added — saved to Firestore");
}

// ─── Admin: Courses ────────────────────────────────
function renderCoursesTable() {
  const tbody = document.getElementById("courses-tbody");
  if (!tbody) return;
  tbody.innerHTML = DB.courses.map(c => {
    const isFull = c.enrolled >= c.capacity;
    return `
      <tr>
        <td>${c.name}</td>
        <td>${c.code}</td>
        <td>${c.credits}</td>
        <td>${c.capacity}</td>
        <td>${c.enrolled}</td>
        <td><span class="badge-status ${isFull ? "full" : "approved"}">${isFull ? "Full" : "Open"}</span></td>
        <td>
          <button class="action-btn" onclick="editCourse('${c.code}')">Edit</button>
          <button class="action-btn danger" onclick="deleteCourse('${c.code}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function editCourse(code) {
  const c = DB.courses.find(x => x.code === code);
  if (!c) return;
  document.getElementById("modal-content").innerHTML = `
    <h3>Edit Course</h3>
    <div class="form-group"><label>Course Name</label><input type="text" id="ec-name" value="${c.name}"/></div>
    <div class="form-row">
      <div class="form-group"><label>Credits</label><input type="number" id="ec-cred" value="${c.credits}"/></div>
      <div class="form-group"><label>Capacity</label><input type="number" id="ec-cap" value="${c.capacity}"/></div>
    </div>
    <div class="form-group"><label>Prerequisites</label><input type="text" id="ec-prereq" value="${c.prereq}"/></div>
    <button class="btn-primary full" onclick="saveCourse('${code}')">Save Changes</button>
  `;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function saveCourse(code) {
  const c = DB.courses.find(x => x.code === code);
  c.name    = document.getElementById("ec-name").value;
  c.credits = Number(document.getElementById("ec-cred").value);
  c.capacity = Number(document.getElementById("ec-cap").value);
  c.prereq  = document.getElementById("ec-prereq").value;
  closeModal();
  renderCoursesTable();
  showToast("✓ Course updated — Firestore write");
}

function deleteCourse(code) {
  DB.courses = DB.courses.filter(x => x.code !== code);
  renderCoursesTable();
  renderCourses();
  showToast("Course removed");
}

function openAddCourse() {
  document.getElementById("modal-content").innerHTML = `
    <h3>Add New Course</h3>
    <div class="form-group"><label>Course Name</label><input type="text" id="nc-name" placeholder="Introduction to AI"/></div>
    <div class="form-row">
      <div class="form-group"><label>Code</label><input type="text" id="nc-code" placeholder="AI201"/></div>
      <div class="form-group"><label>Dept</label><input type="text" id="nc-dept" placeholder="CS"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Credits</label><input type="number" id="nc-cred" placeholder="3"/></div>
      <div class="form-group"><label>Capacity</label><input type="number" id="nc-cap" placeholder="30"/></div>
    </div>
    <div class="form-group"><label>Prerequisites</label><input type="text" id="nc-prereq" placeholder="CS101 or None"/></div>
    <button class="btn-primary full" onclick="addCourse()">Add Course</button>
  `;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function addCourse() {
  DB.courses.push({
    code: document.getElementById("nc-code").value,
    name: document.getElementById("nc-name").value,
    credits: Number(document.getElementById("nc-cred").value) || 3,
    capacity: Number(document.getElementById("nc-cap").value) || 30,
    enrolled: 0,
    prereq: document.getElementById("nc-prereq").value || "None",
    dept: document.getElementById("nc-dept").value || "GEN"
  });
  closeModal();
  renderCoursesTable();
  renderCourses();
  showToast("✓ Course added — saved to Firestore");
}

// ─── Admin: Enrollments ────────────────────────────
function renderEnrollmentsTable() {
  const tbody = document.getElementById("enroll-tbody");
  if (!tbody) return;
  tbody.innerHTML = DB.enrollments.map(e => `
    <tr>
      <td>${e.student}</td>
      <td>${e.course} (${e.code})</td>
      <td>${e.date}</td>
      <td><span class="badge-status ${e.status}">${e.status}</span></td>
      <td>
        ${e.status === "pending" ? `
          <button class="action-btn approve" onclick="approveEnrollment(${e.id})">Approve</button>
          <button class="action-btn reject" onclick="rejectEnrollment(${e.id})">Reject</button>
        ` : "—"}
      </td>
    </tr>
  `).join("");
}

function renderApprovalList() {
  const list = document.getElementById("approval-list");
  if (!list) return;
  const pending = DB.enrollments.filter(e => e.status === "pending");
  if (!pending.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:.9rem">No pending approvals.</p>`;
    return;
  }
  list.innerHTML = pending.map(e => `
    <div class="approval-item">
      <div class="apv-info">
        <strong>${e.student} → ${e.course} (${e.code})</strong>
        <small>Submitted ${e.date} · Student ID: ${e.sid}</small>
      </div>
      <div class="apv-actions">
        <button class="action-btn approve" onclick="approveEnrollment(${e.id})">✓ Approve</button>
        <button class="action-btn reject" onclick="rejectEnrollment(${e.id})">✕ Reject</button>
      </div>
    </div>
  `).join("");
}

function approveEnrollment(id) {
  const e = DB.enrollments.find(x => x.id === id);
  if (e) { e.status = "approved"; }
  renderApprovalList();
  renderEnrollmentsTable();
  showToast(`✓ Enrollment approved — Firestore updated, notification sent`);
}

function rejectEnrollment(id) {
  const e = DB.enrollments.find(x => x.id === id);
  if (e) { e.status = "rejected"; }
  renderApprovalList();
  renderEnrollmentsTable();
  showToast(`Enrollment rejected — student notified`);
}

// ─── Admin: Reports ────────────────────────────────
function generateReport(type) {
  const out = document.getElementById("report-output");
  out.classList.remove("hidden");

  const reports = {
    enrollment: () => {
      const rows = DB.courses.map(c =>
        `<tr><td>${c.name}</td><td>${c.code}</td><td>${c.enrolled}</td><td>${c.capacity}</td><td>${Math.round(c.enrolled/c.capacity*100)}%</td></tr>`
      ).join("");
      return `
        <h4>📋 Enrollment Report — ${new Date().toLocaleDateString()}</h4>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Course</th><th>Code</th><th>Enrolled</th><th>Capacity</th><th>Fill Rate</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`;
    },
    capacity: () => {
      const full = DB.courses.filter(c => c.enrolled >= c.capacity).length;
      const warn = DB.courses.filter(c => c.enrolled/c.capacity >= 0.8 && c.enrolled < c.capacity).length;
      return `
        <h4>📊 Capacity Report — ${new Date().toLocaleDateString()}</h4>
        <div class="kpi-row" style="margin-bottom:1rem">
          <div class="kpi-card"><span class="kpi-icon">🔴</span><div><div class="kpi-num">${full}</div><div class="kpi-label">Full Courses</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">🟡</span><div><div class="kpi-num">${warn}</div><div class="kpi-label">Near Capacity</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">🟢</span><div><div class="kpi-num">${DB.courses.length - full - warn}</div><div class="kpi-label">Open Courses</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">📚</span><div><div class="kpi-num">${DB.courses.length}</div><div class="kpi-label">Total Courses</div></div></div>
        </div>`;
    },
    admission: () => {
      return `
        <h4>🎓 Admission Report — ${new Date().toLocaleDateString()}</h4>
        <p style="color:var(--muted);margin:.5rem 0 1rem">Total registered students: <strong style="color:var(--text)">${DB.students.length + 1242}</strong></p>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Name</th><th>Student ID</th><th>Program</th></tr></thead>
          <tbody>${DB.students.map(s => `<tr><td>${s.name}</td><td>${s.id}</td><td>${s.program}</td></tr>`).join("")}</tbody>
        </table></div>`;
    },
    activity: () => {
      return `
        <h4>📈 Activity Report — ${new Date().toLocaleDateString()}</h4>
        <div class="kpi-row">
          <div class="kpi-card"><span class="kpi-icon">🔐</span><div><div class="kpi-num">847</div><div class="kpi-label">Logins Today</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">📝</span><div><div class="kpi-num">${DB.enrollments.length}</div><div class="kpi-label">Enrollments</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">⏳</span><div><div class="kpi-num">${DB.enrollments.filter(e=>e.status==="pending").length}</div><div class="kpi-label">Pending</div></div></div>
          <div class="kpi-card"><span class="kpi-icon">✅</span><div><div class="kpi-num">${DB.enrollments.filter(e=>e.status==="approved").length}</div><div class="kpi-label">Approved</div></div></div>
        </div>`;
    }
  };

  out.innerHTML = reports[type]?.() || "";
  showToast(`✓ ${type.charAt(0).toUpperCase() + type.slice(1)} report generated`);
}

// ─── Modal ─────────────────────────────────────────
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.getElementById("modal-content").innerHTML = "";
}

// ─── Toast ─────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

// ─── Tech Integration Notes (console) ─────────────
console.info(`
╔══════════════════════════════════════════╗
║         EduPortal — Integration Map      ║
╠══════════════════════════════════════════╣
║ 🔥 Firebase                              ║
║   • Auth: Email/Password + Role Claims   ║
║   • Firestore: Students, Courses, Enrls  ║
║   • Hosting: firebase deploy             ║
║                                          ║
║ 🐙 GitHub                                ║
║   • Repo: github.com/your-org/edu-portal ║
║   • CI: GitHub Actions → test + deploy   ║
║   • Branch protection + PR reviews       ║
║                                          ║
║ ▲ Vercel                                 ║
║   • Auto-deploy on git push              ║
║   • Preview URLs for every PR            ║
║   • Edge Functions for API routes        ║
╚══════════════════════════════════════════╝
`);
