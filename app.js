// ═══════════════════════════════════════════════════════════
//  EduPortal — app.js
//  Firebase Auth + Firestore + Email via EmailJS
//  Replace the config values below with your own project's
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword, EmailAuthProvider,
  reauthenticateWithCredential, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  addDoc, updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── DEPLOYMENT CONFIG (update after deploying) ────────────
const DEPLOYMENT = {
  githubRepo: "https://github.com/Ranjan6501/edu-portal",
  vercelUrl:  "https://edu-portal-lyart.vercel.app",
};

// ─── FIREBASE CONFIG ───────────────────────────────────────
// ⚠️  Replace with YOUR Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDc6fnTLLjZq6NLpMoNa59fJlIhU7xQ44A",
    authDomain: "edu-portal-ranjan.firebaseapp.com",
    databaseURL: "https://edu-portal-ranjan-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "edu-portal-ranjan",
    storageBucket: "edu-portal-ranjan.firebasestorage.app",
    messagingSenderId: "950280364910",
    appId: "1:950280364910:web:fa297e15137298681e577f"
};

// ─── EMAILJS CONFIG ────────────────────────────────────────
// Sign up free at emailjs.com → create a service + template
// Template variables: {{student_name}}, {{student_email}},
//   {{course_name}}, {{course_code}}, {{course_schedule}}
const EMAILJS_CONFIG = {
  serviceId:  "service_c3p7a5t",
  templateId: "template_h2r1m4k",
  publicKey:  "VnQ6zHh-ww1nC3cvj",
};

// ─── ADMIN EMAILS ──────────────────────────────────────────
// Add your admin email(s) here. These accounts get admin access.
const ADMIN_EMAILS = ["ranjanpradhan6501@gmail.com"];

// ═══════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Load EmailJS
const ejsScript = document.createElement("script");
ejsScript.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
ejsScript.onload = () => emailjs.init(EMAILJS_CONFIG.publicKey);
document.head.appendChild(ejsScript);

// ═══════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════
let currentUser = null;
let currentUserData = null;
let allCourses = [];
let allStudents = [];
let allEnrollments = [];
let allPendingItems = [];          // for overview filter
let studentEnrollmentMap = {};     // studentId → [{ courseId, courseName }]
let enrolledCourseIds = {};  // tracks enrolled course statuses for the current student

// ═══════════════════════════════════════════════════════════
//  AUTH STATE LISTENER
// ═══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      currentUserData = snap.data();
      if (currentUserData.role === "admin") {
        initAdminDashboard();
        showPage("page-admin-dashboard");
        // Restore last-visited admin tab
        const savedTab = sessionStorage.getItem("eduportal_admin_tab");
        if (savedTab) showAdminTab(savedTab);
      } else {
        initStudentDashboard();
        showPage("page-student-dashboard");
        // Restore last-visited student tab
        const savedTab = sessionStorage.getItem("eduportal_student_tab");
        if (savedTab) showStudentTab(savedTab);
      }
    }
  } else {
    currentUser = null;
    currentUserData = null;
    const active = document.querySelector(".page.active");
    if (active && ["page-student-dashboard","page-admin-dashboard"].includes(active.id)) {
      showPage("page-landing");
    }
    // Clear saved state on logout
    sessionStorage.removeItem("eduportal_page");
    sessionStorage.removeItem("eduportal_student_tab");
    sessionStorage.removeItem("eduportal_admin_tab");
  }
});

// ═══════════════════════════════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════════════════════════════
window.showPage = (id) => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(id);
  if (page) page.classList.add("active");
  window.scrollTo(0, 0);
  sessionStorage.setItem("eduportal_page", id);
};

// ── Student auth tab switcher ─────────────────────────────
window.switchAuthTab = (tab) => {
  const signinBtn  = document.getElementById("tab-signin-btn");
  const signupBtn  = document.getElementById("tab-signup-btn");
  const signinPanel = document.getElementById("auth-signin-panel");
  const signupPanel = document.getElementById("auth-signup-panel");
  const indicator  = document.getElementById("auth-tab-indicator");

  if (tab === "signin") {
    signinBtn.classList.add("active");
    signupBtn.classList.remove("active");
    signinPanel.classList.add("active");
    signupPanel.classList.remove("active");
    // Slide indicator to left tab
    indicator.style.width  = signinBtn.offsetWidth + "px";
    indicator.style.transform = "translateX(0)";
    document.getElementById("sidebar-headline").textContent = "Welcome Back";
    document.getElementById("sidebar-desc").textContent = "Sign in to your student account to manage enrollments and track your academic progress.";
  } else {
    signupBtn.classList.add("active");
    signinBtn.classList.remove("active");
    signupPanel.classList.add("active");
    signinPanel.classList.remove("active");
    // Slide indicator to right tab
    indicator.style.width  = signupBtn.offsetWidth + "px";
    indicator.style.transform = `translateX(${signinBtn.offsetWidth}px)`;
    document.getElementById("sidebar-headline").textContent = "Join EduPortal";
    document.getElementById("sidebar-desc").textContent = "Create your student account and start managing your courses and enrollments today.";
  }
};

// Initialise indicator on page load
document.addEventListener("DOMContentLoaded", () => {
  const signinBtn = document.getElementById("tab-signin-btn");
  const indicator = document.getElementById("auth-tab-indicator");
  if (signinBtn && indicator) {
    indicator.style.width = signinBtn.offsetWidth + "px";
    indicator.style.transform = "translateX(0)";
  }
});

// ═══════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════
function showToast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 3500);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const text = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  if (loading) {
    btn.disabled = true;
    text && text.classList.add("hidden");
    loader && loader.classList.remove("hidden");
  } else {
    btn.disabled = false;
    text && text.classList.remove("hidden");
    loader && loader.classList.add("hidden");
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}
function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

window.togglePw = (id) => {
  const input = document.getElementById(id);
  input.type = input.type === "password" ? "text" : "password";
};

window.openModal = (id) => document.getElementById(id)?.classList.remove("hidden");
window.closeModal = (id) => document.getElementById(id)?.classList.add("hidden");

// ═══════════════════════════════════════════════════════════
//  REGISTER
// ═══════════════════════════════════════════════════════════
window.handleRegister = async (e) => {
  e.preventDefault();
  hideError("register-error");
  const firstName  = document.getElementById("reg-firstname").value.trim();
  const lastName   = document.getElementById("reg-lastname").value.trim();
  const email      = document.getElementById("reg-email").value.trim();
  const studentId  = document.getElementById("reg-studentid").value.trim();
  const program    = document.getElementById("reg-program").value;
  const dob        = document.getElementById("reg-dob").value;
  const password   = document.getElementById("reg-password").value;
  const password2  = document.getElementById("reg-password2").value;

  if (password !== password2) return showError("register-error", "Passwords do not match.");
  if (password.length < 8)    return showError("register-error", "Password must be at least 8 characters.");

  setLoading("register-submit-btn", true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      firstName, lastName, email, program, dob,
      studentId: studentId || "",
      phone: "",
      role: "student",
      createdAt: serverTimestamp(),
    });
    showToast("Account created! Welcome to EduPortal.", "success");
  } catch (err) {
    showError("register-error", friendlyAuthError(err.code));
  } finally {
    setLoading("register-submit-btn", false);
  }
};

// ═══════════════════════════════════════════════════════════
//  STUDENT LOGIN
// ═══════════════════════════════════════════════════════════
window.handleStudentLogin = async (e) => {
  e.preventDefault();
  hideError("slogin-error");
  const email    = document.getElementById("slogin-email").value.trim();
  const password = document.getElementById("slogin-password").value;
  setLoading("slogin-submit-btn", true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showError("slogin-error", friendlyAuthError(err.code));
  } finally {
    setLoading("slogin-submit-btn", false);
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ═══════════════════════════════════════════════════════════
window.handleAdminLogin = async (e) => {
  e.preventDefault();
  hideError("alogin-error");
  const email    = document.getElementById("alogin-email").value.trim();
  const password = document.getElementById("alogin-password").value;
  if (!ADMIN_EMAILS.includes(email)) {
    return showError("alogin-error", "This email is not authorized as an administrator.");
  }
  setLoading("alogin-submit-btn", true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Ensure admin user doc exists
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, "users", cred.user.uid), {
        firstName: "Admin", lastName: "", email,
        role: "admin", createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    showError("alogin-error", friendlyAuthError(err.code));
  } finally {
    setLoading("alogin-submit-btn", false);
  }
};

// ═══════════════════════════════════════════════════════════
//  LOGOUT
// ═══════════════════════════════════════════════════════════
window.handleLogout = async () => {
  await signOut(auth);
  showPage("page-landing");
  showToast("You've been signed out.");
};

// ═══════════════════════════════════════════════════════════
//  FORGOT PASSWORD
// ═══════════════════════════════════════════════════════════
window.openForgotPassword = (emailInputId) => {
  // Pre-fill with whatever email is already typed in the login form
  const emailVal = document.getElementById(emailInputId)?.value.trim() || "";
  document.getElementById("forgot-pw-email").value = emailVal;
  document.getElementById("forgot-pw-error").classList.add("hidden");
  document.getElementById("forgot-pw-success").classList.add("hidden");
  const btn = document.getElementById("forgot-pw-submit-btn");
  btn.disabled = false;
  btn.textContent = "Send Reset Link";
  openModal("modal-forgot-pw");
};

window.handleForgotPassword = async () => {
  const email = document.getElementById("forgot-pw-email").value.trim();
  const errEl = document.getElementById("forgot-pw-error");
  const okEl  = document.getElementById("forgot-pw-success");
  const btn   = document.getElementById("forgot-pw-submit-btn");

  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  if (!email) {
    errEl.textContent = "Please enter your email address.";
    errEl.classList.remove("hidden");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    await sendPasswordResetEmail(auth, email);
    okEl.textContent  = "✓ Reset link sent! Check your inbox (and spam folder).";
    okEl.classList.remove("hidden");
    btn.textContent = "Link Sent ✓";
  } catch (err) {
    const msgs = {
      "auth/user-not-found":  "No account found with this email address.",
      "auth/invalid-email":   "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
    };
    errEl.textContent = msgs[err.code] || "Failed to send reset link. Please try again.";
    errEl.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
  }
};


function initStudentDashboard() {
  if (!currentUserData) return;
  const { firstName, lastName } = currentUserData;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("student-greeting").textContent = `${greeting}, ${firstName}!`;
  document.getElementById("student-subline").textContent  = "Here's your academic summary";
  document.getElementById("student-avatar").textContent   = firstName[0].toUpperCase();

  // Pre-fill profile form — Personal Information
  document.getElementById("prof-firstname").value      = firstName;
  document.getElementById("prof-lastname").value       = lastName;
  document.getElementById("prof-email").value          = currentUserData.email;
  document.getElementById("prof-studentid").value      = currentUserData.studentId || "";
  document.getElementById("prof-program").value        = currentUserData.program || "";
  document.getElementById("prof-phone").value          = currentUserData.phone || "";
  document.getElementById("prof-dob").value            = currentUserData.dob || "";
  document.getElementById("prof-gender").value         = currentUserData.gender || "";
  document.getElementById("prof-guardian-name").value  = currentUserData.guardianName || "";
  document.getElementById("prof-guardian-phone").value = currentUserData.guardianPhone || "";

  // Pre-fill Address Information
  document.getElementById("prof-state").value    = currentUserData.addrState || "";
  document.getElementById("prof-district").value = currentUserData.addrDistrict || "";
  document.getElementById("prof-pincode").value  = currentUserData.addrPincode || "";
  document.getElementById("prof-village").value  = currentUserData.addrVillage || "";

  // Pre-fill Academic Information — 12th
  document.getElementById("prof-12-board").value       = currentUserData.acad12Board || "";
  document.getElementById("prof-12-percentage").value  = currentUserData.acad12Percentage || "";
  document.getElementById("prof-12-institution").value = currentUserData.acad12Institution || "";
  document.getElementById("prof-12-passout").value     = currentUserData.acad12Passout || "";

  // Pre-fill Academic Information — 10th
  document.getElementById("prof-10-board").value       = currentUserData.acad10Board || "";
  document.getElementById("prof-10-percentage").value  = currentUserData.acad10Percentage || "";
  document.getElementById("prof-10-institution").value = currentUserData.acad10Institution || "";
  document.getElementById("prof-10-passout").value     = currentUserData.acad10Passout || "";

  loadStudentOverview();
  loadStudentCourses();
  loadStudentEnrollments();
}

window.showStudentTab = (tab) => {
  document.querySelectorAll("#page-student-dashboard .dash-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll("#page-student-dashboard .dash-nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
  sessionStorage.setItem("eduportal_student_tab", tab);
};

async function loadStudentOverview() {
  if (!currentUser) return;
  const q = query(collection(db, "enrollments"), where("studentId", "==", currentUser.uid));
  const snap = await getDocs(q);
  let enrolled = 0, pending = 0, credits = 0;
  const activities = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.status === "approved")  { enrolled++; credits += (data.durationYears || 0); }
    if (data.status === "pending")   pending++;
    activities.push({ ...data, id: d.id });
  });
  document.getElementById("ov-enrolled").textContent = enrolled;
  document.getElementById("ov-pending").textContent  = pending;
  document.getElementById("ov-credits").textContent  = credits;

  const list = document.getElementById("recent-activity");
  if (!activities.length) { list.innerHTML = '<div class="empty-state">No enrollment activity yet.</div>'; return; }
  activities.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  list.innerHTML = activities.slice(0,6).map(a => {
    const dot = a.status === "approved" ? "green" : a.status === "rejected" ? "red" : "amber";
    return `<div class="activity-item">
      <div class="activity-dot ${dot}"></div>
      <div class="activity-text"><strong>${a.courseName}</strong> — ${a.status}</div>
      <div class="activity-time">${timeAgo(a.createdAt)}</div>
    </div>`;
  }).join("");
}

async function loadStudentCourses() {
  const grid = document.getElementById("courses-grid");
  grid.innerHTML = '<div class="loading-state">Loading courses…</div>';
  try {
    const snap = await getDocs(collection(db, "courses"));
    allCourses = [];
    snap.forEach(d => allCourses.push({ id: d.id, ...d.data() }));
    // Also load student's enrollments to check statuses
    const eq = query(collection(db, "enrollments"), where("studentId", "==", currentUser.uid));
    const eSnap = await getDocs(eq);
    enrolledCourseIds = {};  // update global state
    eSnap.forEach(d => { enrolledCourseIds[d.data().courseId] = d.data().status; });
    renderCoursesGrid(allCourses, enrolledCourseIds);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error loading courses: ${err.message}</div>`;
  }
}

function renderCoursesGrid(courses, enrolledMap = {}) {
  const grid = document.getElementById("courses-grid");
  if (!courses.length) { grid.innerHTML = '<div class="empty-state">No courses found.</div>'; return; }
  grid.innerHTML = courses.map(c => {
    const pct = Math.round(((c.enrolled || 0) / (c.capacity || 1)) * 100);
    const fillClass = pct >= 100 ? "full" : pct >= 80 ? "warn" : "";
    const status = enrolledMap[c.id];
    let btnHtml;
    if (status === "approved") {
      btnHtml = `<button class="btn-enroll" disabled>✓ Enrolled</button>`;
    } else if (status === "pending") {
      btnHtml = `<button class="btn-enroll pending" disabled>⏳ Pending Approval</button>`;
    } else if ((c.enrolled || 0) >= (c.capacity || 0)) {
      btnHtml = `<button class="btn-enroll" disabled>Course Full</button>`;
    } else {
      btnHtml = `<button class="btn-enroll" onclick="requestEnrollment('${c.id}')">Request Enrollment</button>`;
    }
    return `<div class="course-card">
      <div class="course-card-header">
        <span class="course-code-badge">${c.code || "—"}</span>
        <span class="course-credits">${c.durationYears || 0} yr${(c.durationYears || 0) !== 1 ? "s" : ""}</span>
      </div>
      <h4>${c.name}</h4>
      ${c.courseType ? `<div class="course-instructor">📚 ${c.courseType}</div>` : ""}
      <div class="course-capacity-bar-wrap">
        <div class="capacity-label">
          <span>Capacity</span>
          <span>${c.enrolled || 0}/${c.capacity || 0}</span>
        </div>
        <div class="capacity-bar"><div class="capacity-fill ${fillClass}" style="width:${Math.min(pct,100)}%"></div></div>
      </div>
      <div class="course-card-actions">${btnHtml}</div>
    </div>`;
  }).join("");
}

window.filterCourses = () => {
  const q    = document.getElementById("course-search").value.toLowerCase();
  const dept = document.getElementById("course-dept-filter").value;
  const filtered = allCourses.filter(c => {
    const matchQ = !q || c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q);
    const matchD = !dept || c.program === dept;
    return matchQ && matchD;
  });
  renderCoursesGrid(filtered, enrolledCourseIds);  // preserve enrollment status after filter
};

window.requestEnrollment = async (courseId) => {
  if (!currentUser || !currentUserData) return;
  const course = allCourses.find(c => c.id === courseId);
  if (!course) return;

  // Check if student already has ANY enrollment (pending or approved)
  const existingSnap = await getDocs(query(
    collection(db, "enrollments"),
    where("studentId", "==", currentUser.uid)
  ));
  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data();
    showToast(
      `You already have a ${existing.status} enrollment in "${existing.courseName}". Only one course is allowed.`,
      "warning"
    );
    return;
  }

  // Show confirmation popup
  document.getElementById("enroll-confirm-course-name").textContent =
    `${course.name} (${course.code})`;
  document.getElementById("enroll-confirm-course-id").value = courseId;
  openModal("modal-enroll-confirm");
};

window.confirmEnrollment = async () => {
  const courseId = document.getElementById("enroll-confirm-course-id").value;
  const course = allCourses.find(c => c.id === courseId);
  if (!course || !currentUser || !currentUserData) return;
  closeModal("modal-enroll-confirm");
  try {
    await addDoc(collection(db, "enrollments"), {
      studentId:    currentUser.uid,
      studentName:  `${currentUserData.firstName} ${currentUserData.lastName}`,
      studentEmail: currentUserData.email,
      studentPhone: currentUserData.phone || "",
      courseId:     course.id,
      courseName:   course.name,
      courseCode:   course.code,
      durationYears: course.durationYears || 0,
      program:      course.program || "",
      courseType:   course.courseType || "",
      status:       "pending",
      createdAt:    serverTimestamp(),
    });
    showToast("Enrollment request submitted!", "success");
    loadStudentCourses();
    loadStudentOverview();
  } catch (err) {
    showToast("Failed to submit request: " + err.message, "error");
  }
};

async function loadStudentEnrollments() {
  const list = document.getElementById("enrollments-list");
  list.innerHTML = '<div class="loading-state">Loading…</div>';
  try {
    const q = query(collection(db, "enrollments"),
      where("studentId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    if (snap.empty) { list.innerHTML = '<div class="empty-state">No enrollments yet.</div>'; return; }
    list.innerHTML = snap.docs.map(d => {
      const e = d.data();
      return `<div class="enrollment-item">
        <div class="enrollment-info">
          <div class="enrollment-course-name">${e.courseName}</div>
          <div class="enrollment-meta">${e.courseCode} · ${e.durationYears || 0} yr(s) · ${e.courseType || ""} · ${formatDate(e.createdAt)}</div>
        </div>
        <span class="status-badge ${e.status}">${e.status}</span>
        ${e.status === "pending" ? `<button class="btn-drop" onclick="dropEnrollment('${d.id}')">Drop</button>` : ""}
      </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

window.dropEnrollment = async (enrollmentId) => {
  if (!confirm("Are you sure you want to drop this enrollment request?")) return;
  try {
    // Fetch first so we know the status before deleting
    const snap = await getDoc(doc(db, "enrollments", enrollmentId));
    if (!snap.exists()) return;
    const enrollment = snap.data();

    await deleteDoc(doc(db, "enrollments", enrollmentId));

    // If approved, decrement the course's enrolled count
    if (enrollment.status === "approved") {
      await updateDoc(doc(db, "courses", enrollment.courseId), { enrolled: increment(-1) });
    }

    showToast("Enrollment dropped.", "success");
    loadStudentEnrollments();
    loadStudentOverview();
    loadStudentCourses();  // refresh so button state updates
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────
window.handleUpdateProfile = async (e) => {
  e.preventDefault();
  const data = {
    // Editable personal fields only (locked fields managed by admin)
    phone:          document.getElementById("prof-phone").value.trim(),
    gender:         document.getElementById("prof-gender").value,
    guardianName:   document.getElementById("prof-guardian-name").value.trim(),
    guardianPhone:  document.getElementById("prof-guardian-phone").value.trim(),
    // Address Information
    addrState:      document.getElementById("prof-state").value.trim(),
    addrDistrict:   document.getElementById("prof-district").value.trim(),
    addrPincode:    document.getElementById("prof-pincode").value.trim(),
    addrVillage:    document.getElementById("prof-village").value.trim(),
    // Academic Information — 12th
    acad12Board:        document.getElementById("prof-12-board").value.trim(),
    acad12Percentage:   document.getElementById("prof-12-percentage").value,
    acad12Institution:  document.getElementById("prof-12-institution").value.trim(),
    acad12Passout:      document.getElementById("prof-12-passout").value,
    // Academic Information — 10th
    acad10Board:        document.getElementById("prof-10-board").value.trim(),
    acad10Percentage:   document.getElementById("prof-10-percentage").value,
    acad10Institution:  document.getElementById("prof-10-institution").value.trim(),
    acad10Passout:      document.getElementById("prof-10-passout").value,
  };
  try {
    await updateDoc(doc(db, "users", currentUser.uid), data);
    currentUserData = { ...currentUserData, ...data };
    showSuccess("profile-msg", "✓ Profile updated successfully.");
    showToast("Profile saved!", "success");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────
window.handleChangePassword = async (e) => {
  e.preventDefault();
  hideError("pw-error");
  const current = document.getElementById("pw-current").value;
  const newPw   = document.getElementById("pw-new").value;
  const confirm = document.getElementById("pw-confirm").value;
  if (newPw !== confirm) return showError("pw-error", "New passwords do not match.");
  if (newPw.length < 8)  return showError("pw-error", "Password must be at least 8 characters.");
  try {
    const credential = EmailAuthProvider.credential(currentUser.email, current);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPw);
    e.target.reset();
    showSuccess("pw-msg", "✓ Password updated successfully.");
    showToast("Password changed!", "success");
  } catch (err) {
    showError("pw-error", friendlyAuthError(err.code));
  }
};

// ═══════════════════════════════════════════════════════════
//  CORRECTION REQUESTS — STUDENT SIDE
// ═══════════════════════════════════════════════════════════
const LOCKED_FIELD_LABELS = {
  firstName: "First Name",
  lastName:  "Last Name",
  studentId: "Student ID",
  program:   "Program",
  dob:       "Date of Birth",
};

window.openCorrectionRequest = () => {
  document.getElementById("cr-field").value      = "";
  document.getElementById("cr-current").value    = "";
  document.getElementById("cr-new-value").value  = "";
  document.getElementById("cr-reason").value     = "";
  document.getElementById("cr-error").classList.add("hidden");
  document.getElementById("cr-success").classList.add("hidden");
  openModal("modal-correction-request");
};

window.updateCorrectionCurrentValue = () => {
  const field = document.getElementById("cr-field").value;
  const currentVal = field ? (currentUserData?.[field] || "—") : "";
  document.getElementById("cr-current").value = currentVal;
  document.getElementById("cr-new-value").value = "";
};

window.submitCorrectionRequest = async () => {
  const field      = document.getElementById("cr-field").value;
  const newValue   = document.getElementById("cr-new-value").value.trim();
  const reason     = document.getElementById("cr-reason").value.trim();
  const errEl      = document.getElementById("cr-error");
  const okEl       = document.getElementById("cr-success");

  errEl.classList.add("hidden");
  okEl.classList.add("hidden");

  if (!field)    { errEl.textContent = "Please select a field to correct."; errEl.classList.remove("hidden"); return; }
  if (!newValue) { errEl.textContent = "Please enter the correct value.";   errEl.classList.remove("hidden"); return; }

  const currentValue = currentUserData?.[field] || "";
  if (newValue === currentValue) {
    errEl.textContent = "The correct value is the same as the current value.";
    errEl.classList.remove("hidden");
    return;
  }

  try {
    // Check if a pending request for this field already exists
    const existing = await getDocs(query(
      collection(db, "changeRequests"),
      where("studentUid", "==", currentUser.uid),
      where("fieldKey",   "==", field),
      where("status",     "==", "pending")
    ));
    if (!existing.empty) {
      errEl.textContent = `You already have a pending correction request for "${LOCKED_FIELD_LABELS[field]}".`;
      errEl.classList.remove("hidden");
      return;
    }

    await addDoc(collection(db, "changeRequests"), {
      studentUid:     currentUser.uid,
      studentName:    `${currentUserData.firstName} ${currentUserData.lastName}`,
      studentEmail:   currentUserData.email,
      fieldKey:       field,
      fieldLabel:     LOCKED_FIELD_LABELS[field],
      currentValue,
      requestedValue: newValue,
      reason:         reason || "—",
      status:         "pending",
      createdAt:      serverTimestamp(),
    });

    okEl.textContent = "✓ Correction request submitted! An admin will review it shortly.";
    okEl.classList.remove("hidden");
    document.getElementById("cr-field").value     = "";
    document.getElementById("cr-current").value   = "";
    document.getElementById("cr-new-value").value = "";
    document.getElementById("cr-reason").value    = "";
  } catch (err) {
    errEl.textContent = "Error submitting request: " + err.message;
    errEl.classList.remove("hidden");
  }
};

// ═══════════════════════════════════════════════════════════
//  CORRECTION REQUESTS — ADMIN SIDE
// ═══════════════════════════════════════════════════════════
async function loadAdminCorrectionRequests() {
  const wrap = document.getElementById("admin-correction-requests");
  if (!wrap) return;
  try {
    const snap = await getDocs(query(
      collection(db, "changeRequests"),
      where("status", "==", "pending"),
      orderBy("createdAt", "asc")
    ));
    if (snap.empty) {
      wrap.innerHTML = '<div class="empty-state">No pending correction requests.</div>';
      return;
    }
    wrap.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="pending-item">
        <div>
          <div class="pending-student">${r.studentName}
            <span class="cr-field-badge">${r.fieldLabel}</span>
          </div>
          <div class="pending-meta">
            <span class="cr-value-change">
              <span class="cr-old">${r.currentValue || "—"}</span>
              <span class="cr-arrow">→</span>
              <span class="cr-new">${r.requestedValue}</span>
            </span>
            · Reason: <em>${r.reason}</em> · ${timeAgo(r.createdAt)}
          </div>
        </div>
        <div class="pending-actions">
          <button class="btn-action btn-approve" onclick="approveCorrectionRequest('${d.id}')">Approve</button>
          <button class="btn-action btn-reject"  onclick="openRejectCorrection('${d.id}')">Reject</button>
        </div>
      </div>`;
    }).join("");
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

window.approveCorrectionRequest = async (requestId) => {
  try {
    const snap = await getDoc(doc(db, "changeRequests", requestId));
    if (!snap.exists()) return;
    const r = snap.data();

    // Write the corrected value to the student's user document
    await updateDoc(doc(db, "users", r.studentUid), { [r.fieldKey]: r.requestedValue });

    // Mark the request as approved
    await updateDoc(doc(db, "changeRequests", requestId), {
      status: "approved",
      resolvedAt: serverTimestamp(),
    });

    // Update local allStudents cache
    const idx = allStudents.findIndex(s => s.id === r.studentUid);
    if (idx !== -1) allStudents[idx] = { ...allStudents[idx], [r.fieldKey]: r.requestedValue };

    showToast(`✓ Correction approved — ${r.fieldLabel} updated for ${r.studentName}`, "success");
    loadAdminCorrectionRequests();
    renderAdminStudentsTable(allStudents);
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

window.openRejectCorrection = (requestId) => {
  document.getElementById("reject-cr-id").value     = requestId;
  document.getElementById("reject-cr-reason").value = "";
  openModal("modal-reject-correction");
};

window.confirmRejectCorrectionRequest = async () => {
  const requestId = document.getElementById("reject-cr-id").value;
  const reason    = document.getElementById("reject-cr-reason").value.trim();
  try {
    const snap = await getDoc(doc(db, "changeRequests", requestId));
    if (!snap.exists()) return;
    const r = snap.data();

    await updateDoc(doc(db, "changeRequests", requestId), {
      status: "rejected",
      rejectionReason: reason || "—",
      resolvedAt: serverTimestamp(),
    });

    closeModal("modal-reject-correction");
    showToast(`Correction request rejected for ${r.studentName}.`, "warning");
    loadAdminCorrectionRequests();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
};

// ═══════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════
async function initAdminDashboard() {
  document.getElementById("admin-subline").textContent =
    `Signed in as ${currentUserData?.email}`;
  await Promise.all([
    loadAdminOverview(),
    loadAdminStudents(),
    loadAdminCourses(),
    loadAdminEnrollments(),
    loadAdminCorrectionRequests(),
  ]);
}

window.showAdminTab = (tab) => {
  document.querySelectorAll("#page-admin-dashboard .dash-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll("#page-admin-dashboard .dash-nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
  sessionStorage.setItem("eduportal_admin_tab", tab);
};

async function loadAdminOverview() {
  try {
    const [studentsSnap, coursesSnap, enrollSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "student"))),
      getDocs(collection(db, "courses")),
      getDocs(collection(db, "enrollments")),
    ]);
    let pending = 0, approved = 0;
    allPendingItems = [];
    enrollSnap.forEach(d => {
      const e = d.data();
      if (e.status === "pending")  { pending++; allPendingItems.push({ id: d.id, ...e }); }
      if (e.status === "approved") approved++;
    });
    document.getElementById("adm-total-students").textContent = studentsSnap.size;
    document.getElementById("adm-pending").textContent        = pending;
    document.getElementById("adm-total-courses").textContent  = coursesSnap.size;
    document.getElementById("adm-approved").textContent       = approved;

    // Populate course filter dropdown for overview
    const overviewCourseFilter = document.getElementById("adm-overview-course-filter");
    if (overviewCourseFilter) {
      const courseNames = [...new Set(allPendingItems.map(e => e.courseName).filter(Boolean))].sort();
      overviewCourseFilter.innerHTML = '<option value="">All Courses</option>' +
        courseNames.map(n => `<option value="${n}">${n}</option>`).join("");
    }

    renderAdminOverviewPending(allPendingItems);
  } catch (err) { console.error("loadAdminOverview:", err); }
}

function renderAdminOverviewPending(items) {
  const list = document.getElementById("adm-pending-list");
  if (!items.length) { list.innerHTML = '<div class="empty-state">No pending requests.</div>'; return; }
  list.innerHTML = items.slice(0, 8).map(e => `
    <div class="pending-item">
      <div>
        <div class="pending-student">${e.studentName}</div>
        <div class="pending-meta">${e.studentEmail} · <strong>${e.courseName}</strong> (${e.courseCode}) · ${timeAgo(e.createdAt)}</div>
      </div>
      <div class="pending-actions">
        <button class="btn-action btn-approve" onclick="approveEnrollment('${e.id}')">Approve</button>
        <button class="btn-action btn-reject"  onclick="rejectEnrollment('${e.id}')">Reject</button>
      </div>
    </div>`).join("");
}

window.filterAdminOverview = () => {
  const course  = document.getElementById("adm-overview-course-filter").value;
  const program = document.getElementById("adm-overview-program-filter").value;
  const filtered = allPendingItems.filter(e =>
    (!course  || e.courseName === course) &&
    (!program || e.program    === program)
  );
  renderAdminOverviewPending(filtered);
};

async function loadAdminStudents() {
  const wrap = document.getElementById("admin-students-table");
  try {
    const [studSnap, enrollSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "student"))),
      getDocs(collection(db, "enrollments")),
    ]);

    // Build per-student enrollment data
    const courseCountMap = {};
    studentEnrollmentMap = {};
    const courseNamesSet = new Set();
    enrollSnap.forEach(d => {
      const e = d.data();
      const sid = e.studentId;
      if (!sid) return;
      courseCountMap[sid] = (courseCountMap[sid] || 0) + 1;
      if (!studentEnrollmentMap[sid]) studentEnrollmentMap[sid] = [];
      studentEnrollmentMap[sid].push({ courseId: e.courseId, courseName: e.courseName });
      if (e.courseName) courseNamesSet.add(e.courseName);
    });

    allStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Populate course filter dropdown for students
    const studentCourseFilter = document.getElementById("adm-student-course-filter");
    if (studentCourseFilter) {
      const sorted = [...courseNamesSet].sort();
      studentCourseFilter.innerHTML = '<option value="">All Courses</option>' +
        sorted.map(n => `<option value="${n}">${n}</option>`).join("");
    }

    renderAdminStudentsTable(allStudents, courseCountMap);
  } catch (err) { wrap.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
}

function renderAdminStudentsTable(students, courseCountMap = {}) {
  const wrap = document.getElementById("admin-students-table");
  if (!students.length) { wrap.innerHTML = '<div class="empty-state">No students found.</div>'; return; }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Name</th><th>Email</th><th>Student ID</th><th>Program</th><th>Courses</th><th>Actions</th>
    </tr></thead>
    <tbody>${students.map(s => `<tr>
      <td>${s.firstName} ${s.lastName}</td>
      <td>${s.email}</td>
      <td>${s.studentId || "—"}</td>
      <td>${s.program || "—"}</td>
      <td>${courseCountMap[s.id] !== undefined ? courseCountMap[s.id] : (studentEnrollmentMap[s.id]?.length || 0)}</td>
      <td>
        <button class="btn-action btn-view"   onclick="viewStudent('${s.id}')">View</button>
        <button class="btn-action btn-delete" onclick="deleteStudent('${s.id}')">Delete</button>
      </td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window.filterAdminStudents = () => {
  const q       = document.getElementById("adm-student-search").value.toLowerCase();
  const course  = document.getElementById("adm-student-course-filter").value;
  const program = document.getElementById("adm-student-program-filter").value;
  const filtered = allStudents.filter(s => {
    const matchQ = !q || `${s.firstName} ${s.lastName} ${s.email} ${s.studentId} ${s.program}`.toLowerCase().includes(q);
    const matchP = !program || s.program === program;
    const matchC = !course  || (studentEnrollmentMap[s.id] || []).some(e => e.courseName === course);
    return matchQ && matchP && matchC;
  });
  renderAdminStudentsTable(filtered);
};

window.deleteStudent = async (uid) => {
  const s = allStudents.find(x => x.id === uid);
  if (!s) return;
  if (!confirm(`Delete student "${s.firstName} ${s.lastName}"? This will also remove all their enrollment records and cannot be undone.`)) return;
  try {
    // Delete all enrollment records for this student
    const enrollSnap = await getDocs(query(collection(db, "enrollments"), where("studentId", "==", uid)));
    const deletions = enrollSnap.docs.map(d => deleteDoc(doc(db, "enrollments", d.id)));
    await Promise.all(deletions);
    // Delete the user document
    await deleteDoc(doc(db, "users", uid));
    showToast(`Student "${s.firstName} ${s.lastName}" deleted.`, "success");
    loadAdminStudents();
    loadAdminOverview();
  } catch (err) { showToast("Error deleting student: " + err.message, "error"); }
};

window.viewStudent = async (uid) => {
  const s = allStudents.find(x => x.id === uid);
  if (!s) return;
  const eSnap = await getDocs(query(collection(db, "enrollments"), where("studentId", "==", uid)));
  const enrollments = eSnap.docs.map(d => d.data());
  document.getElementById("student-detail-content").innerHTML = `
    <div class="student-detail">

      <!-- Admin: Edit Locked Fields -->
      <div class="detail-section-title">🔒 Core Information <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(admin editable)</span></div>
      <div class="admin-core-edit-grid">
        <div class="form-group">
          <label>First Name</label>
          <input type="text" id="admin-edit-firstname" value="${s.firstName || ""}" class="admin-core-input" />
        </div>
        <div class="form-group">
          <label>Last Name</label>
          <input type="text" id="admin-edit-lastname" value="${s.lastName || ""}" class="admin-core-input" />
        </div>
        <div class="form-group">
          <label>Student ID</label>
          <input type="text" id="admin-edit-studentid" value="${s.studentId || ""}" class="admin-core-input" />
        </div>
        <div class="form-group">
          <label>Program</label>
          <select id="admin-edit-program" class="admin-core-input">
            <option value="">Select Program</option>
            <option ${s.program === "Undergraduate" ? "selected" : ""}>Undergraduate</option>
            <option ${s.program === "Postgraduate"  ? "selected" : ""}>Postgraduate</option>
          </select>
        </div>
        <div class="form-group">
          <label>Date of Birth</label>
          <input type="date" id="admin-edit-dob" value="${s.dob || ""}" class="admin-core-input" />
        </div>
      </div>
      <div id="admin-core-edit-msg" class="form-success hidden" style="margin:6px 0 2px"></div>
      <button class="btn-primary" style="margin-bottom:20px" onclick="adminSaveCoreInfo('${uid}')">Save Core Info</button>

      <!-- Personal Information -->
      <div class="detail-section-title">Personal Information</div>
      <div class="student-detail-grid">
        <div><div class="detail-label">Email</div><div class="detail-value">${s.email}</div></div>
        <div><div class="detail-label">Phone</div><div class="detail-value">${s.phone || "—"}</div></div>
        <div><div class="detail-label">Gender</div><div class="detail-value">${s.gender || "—"}</div></div>
        <div><div class="detail-label">Guardian Name</div><div class="detail-value">${s.guardianName || "—"}</div></div>
        <div><div class="detail-label">Guardian Phone</div><div class="detail-value">${s.guardianPhone || "—"}</div></div>
        <div><div class="detail-label">Registered</div><div class="detail-value">${formatDate(s.createdAt)}</div></div>
      </div>

      <!-- Address Information -->
      <div class="detail-section-title">Address Information</div>
      <div class="student-detail-grid">
        <div><div class="detail-label">State</div><div class="detail-value">${s.addrState || "—"}</div></div>
        <div><div class="detail-label">District</div><div class="detail-value">${s.addrDistrict || "—"}</div></div>
        <div><div class="detail-label">Pin Code</div><div class="detail-value">${s.addrPincode || "—"}</div></div>
        <div><div class="detail-label">Village / Town</div><div class="detail-value">${s.addrVillage || "—"}</div></div>
      </div>

      <!-- Academic Information -->
      <div class="detail-section-title">Academic Information</div>
      <div class="detail-subsection-title">12th Standard</div>
      <div class="student-detail-grid">
        <div><div class="detail-label">Board</div><div class="detail-value">${s.acad12Board || "—"}</div></div>
        <div><div class="detail-label">Percentage</div><div class="detail-value">${s.acad12Percentage ? s.acad12Percentage + "%" : "—"}</div></div>
        <div><div class="detail-label">Institution</div><div class="detail-value">${s.acad12Institution || "—"}</div></div>
        <div><div class="detail-label">Passout Year</div><div class="detail-value">${s.acad12Passout || "—"}</div></div>
      </div>
      <div class="detail-subsection-title">10th Standard</div>
      <div class="student-detail-grid">
        <div><div class="detail-label">Board</div><div class="detail-value">${s.acad10Board || "—"}</div></div>
        <div><div class="detail-label">Percentage</div><div class="detail-value">${s.acad10Percentage ? s.acad10Percentage + "%" : "—"}</div></div>
        <div><div class="detail-label">Institution</div><div class="detail-value">${s.acad10Institution || "—"}</div></div>
        <div><div class="detail-label">Passout Year</div><div class="detail-value">${s.acad10Passout || "—"}</div></div>
      </div>

      <!-- Courses -->
      <div class="detail-section-title">Courses (${enrollments.length})</div>
      ${enrollments.length
        ? `<table class="data-table" style="margin-top:12px"><thead><tr><th>Course</th><th>Code</th><th>Status</th></tr></thead>
           <tbody>${enrollments.map(e => `<tr><td>${e.courseName}</td><td>${e.courseCode}</td><td><span class="status-badge ${e.status}">${e.status}</span></td></tr>`).join("")}</tbody></table>`
        : '<p style="color:var(--text-muted);font-size:14px;margin-top:8px">No courses yet.</p>'
      }
    </div>`;
  openModal("modal-student");
};

window.adminSaveCoreInfo = async (uid) => {
  const firstName = document.getElementById("admin-edit-firstname").value.trim();
  const lastName  = document.getElementById("admin-edit-lastname").value.trim();
  const studentId = document.getElementById("admin-edit-studentid").value.trim();
  const program   = document.getElementById("admin-edit-program").value;
  const dob       = document.getElementById("admin-edit-dob").value;
  const msgEl     = document.getElementById("admin-core-edit-msg");

  if (!firstName || !lastName) {
    msgEl.textContent = "First Name and Last Name are required.";
    msgEl.className = "form-error";
    msgEl.classList.remove("hidden");
    return;
  }
  try {
    await updateDoc(doc(db, "users", uid), { firstName, lastName, studentId, program, dob });
    // Update local cache so the table reflects the change without a full reload
    const idx = allStudents.findIndex(s => s.id === uid);
    if (idx !== -1) allStudents[idx] = { ...allStudents[idx], firstName, lastName, studentId, program, dob };
    msgEl.textContent = "✓ Core information updated successfully.";
    msgEl.className = "form-success";
    msgEl.classList.remove("hidden");
    showToast("Student core info saved!", "success");
  } catch (err) {
    msgEl.textContent = "Error: " + err.message;
    msgEl.className = "form-error";
    msgEl.classList.remove("hidden");
  }
};

// ─── COURSES ADMIN ────────────────────────────────────────
async function loadAdminCourses() {
  const wrap = document.getElementById("admin-courses-table");
  try {
    const snap = await getDocs(collection(db, "courses"));
    allCourses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminCoursesTable(allCourses);
  } catch (err) { wrap.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
}

window.filterAdminCourses = () => {
  const program = document.getElementById("adm-course-program-filter").value;
  const filtered = allCourses.filter(c => !program || c.program === program);
  renderAdminCoursesTable(filtered);
};

function renderAdminCoursesTable(courses) {
  const wrap = document.getElementById("admin-courses-table");
  if (!courses.length) { wrap.innerHTML = '<div class="empty-state">No courses found. Add one above.</div>'; return; }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Code</th><th>Course Name</th><th>Program</th><th>Type</th><th>Capacity</th><th>Duration (Yrs)</th><th>Actions</th>
    </tr></thead>
    <tbody>${courses.map(c => {
      const pct = Math.round(((c.enrolled||0)/(c.capacity||1))*100);
      return `<tr>
        <td><span class="course-code-badge">${c.code}</span></td>
        <td>${c.name}</td>
        <td>${c.program || "—"}</td>
        <td>${c.courseType || "—"}</td>
        <td>
          <div class="capacity-bar" style="width:80px;display:inline-block;vertical-align:middle;margin-right:6px">
            <div class="capacity-fill ${pct>=100?"full":pct>=80?"warn":""}" style="width:${Math.min(pct,100)}%"></div>
          </div>${c.enrolled||0}/${c.capacity}
        </td>
        <td>${c.durationYears || 0} yr(s)</td>
        <td>
          <button class="btn-action btn-view"   onclick="viewCourseStudents('${c.id}')">Students</button>
          <button class="btn-action btn-csv"    onclick="downloadCourseStudentsCSV('${c.id}')">⬇ CSV</button>
          <button class="btn-action btn-edit"   onclick="openEditCourseModal('${c.id}')">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteCourse('${c.id}')">Delete</button>
        </td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}

// Store the last-viewed course enrollment data for CSV export
let _csvCourseData = { courseName: "", courseCode: "", enrollments: [] };

window.viewCourseStudents = async (courseId) => {
  const course = allCourses.find(c => c.id === courseId);
  if (!course) return;
  document.getElementById("modal-course-students-title").textContent =
    `Enrolled Students — ${course.name} (${course.code})`;
  document.getElementById("course-students-content").innerHTML =
    '<div class="loading-state">Loading…</div>';
  document.getElementById("btn-download-course-csv").classList.add("hidden");
  openModal("modal-course-students");
  try {
    const snap = await getDocs(query(collection(db, "enrollments"), where("courseId", "==", courseId)));
    const enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _csvCourseData = { courseName: course.name, courseCode: course.code, enrollments };

    if (!enrollments.length) {
      document.getElementById("course-students-content").innerHTML =
        '<p style="color:var(--text-muted);font-size:14px;padding:12px 0">No students enrolled in this course yet.</p>';
      return;
    }
    document.getElementById("btn-download-course-csv").classList.remove("hidden");
    document.getElementById("course-students-content").innerHTML = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">${enrollments.length} enrollment record(s)</p>
      <table class="data-table">
        <thead><tr><th>Student Name</th><th>Email</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${enrollments.map(e => `<tr>
          <td>${e.studentName}</td>
          <td>${e.studentEmail}</td>
          <td><span class="status-badge ${e.status}">${e.status}</span></td>
          <td>${formatDate(e.createdAt)}</td>
        </tr>`).join("")}</tbody>
      </table>`;
  } catch (err) {
    document.getElementById("course-students-content").innerHTML =
      `<div class="empty-state">Error: ${err.message}</div>`;
  }
};

window.downloadCourseStudentsCSV = async (courseId) => {
  // If called from table row button, fetch fresh; if called from modal use cached
  let courseName, courseCode, enrollments;

  if (courseId) {
    // Called directly from course table row — fetch live
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    courseName = course.name;
    courseCode = course.code;
    try {
      const snap = await getDocs(query(collection(db, "enrollments"), where("courseId", "==", courseId)));
      enrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      showToast("Error fetching data: " + err.message, "error");
      return;
    }
  } else {
    // Called from modal button — use cached data
    ({ courseName, courseCode, enrollments } = _csvCourseData);
  }

  if (!enrollments || !enrollments.length) {
    showToast("No students to download for this course.", "warning");
    return;
  }

  // Enrich with student profile data (phone, studentId) from allStudents cache
  const rows = enrollments.map(e => {
    const profile = allStudents.find(s => s.id === e.studentId) || {};
    return [
      `"${e.studentName   || ""}"`,
      `"${profile.studentId || e.studentId || ""}"`,
      `"${e.studentEmail  || ""}"`,
      `"${profile.phone   || e.studentPhone || ""}"`,
    ];
  });

  const headers = ["Student Name", "Student ID", "Email", "Phone Number"];
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  // File named: CourseName_CourseCode.csv
  const fileName = `${courseName}_${courseCode}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded: ${fileName}`, "success");
};

window.openAddCourseModal = () => {
  document.getElementById("modal-course-title").textContent = "Add New Course";
  document.getElementById("course-edit-id").value = "";
  ["course-code","course-name"].forEach(id =>
    document.getElementById(id).value = ""
  );
  document.getElementById("course-duration").value = "";
  document.getElementById("course-capacity").value = "";
  document.getElementById("course-dept").value      = "";
  document.getElementById("course-type").value      = "";
  openModal("modal-course");
};

window.openEditCourseModal = (id) => {
  const c = allCourses.find(x => x.id === id);
  if (!c) return;
  document.getElementById("modal-course-title").textContent = "Edit Course";
  document.getElementById("course-edit-id").value   = id;
  document.getElementById("course-code").value      = c.code || "";
  document.getElementById("course-name").value      = c.name || "";
  document.getElementById("course-dept").value      = c.program || "";
  document.getElementById("course-duration").value  = c.durationYears || "";
  document.getElementById("course-capacity").value  = c.capacity || "";
  document.getElementById("course-type").value      = c.courseType || "";
  openModal("modal-course");
};

window.handleSaveCourse = async (e) => {
  e.preventDefault();
  const editId = document.getElementById("course-edit-id").value;
  const data = {
    code:          document.getElementById("course-code").value.trim(),
    name:          document.getElementById("course-name").value.trim(),
    program:       document.getElementById("course-dept").value,
    durationYears: parseInt(document.getElementById("course-duration").value),
    capacity:      parseInt(document.getElementById("course-capacity").value),
    courseType:    document.getElementById("course-type").value,
  };
  try {
    if (!data.code || !data.name || isNaN(data.capacity) || isNaN(data.durationYears) || !data.courseType) {
      return showToast("Please fill in all required fields (Code, Name, Program, Duration, Type, Capacity).", "error");
    }
    if (editId) {
      await updateDoc(doc(db, "courses", editId), data);
      showToast("Course updated!", "success");
    } else {
      data.enrolled = 0;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "courses"), data);
      showToast("Course added!", "success");
    }
    closeModal("modal-course");
    loadAdminCourses();
  } catch (err) { showToast("Error: " + err.message, "error"); }
};

window.deleteCourse = async (id) => {
  if (!confirm("Delete this course? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "courses", id));
    showToast("Course deleted.", "success");
    loadAdminCourses();
  } catch (err) { showToast("Error: " + err.message, "error"); }
};

// ─── ENROLLMENTS ADMIN ────────────────────────────────────
window.loadAdminEnrollments = async () => {
  const wrap = document.getElementById("admin-enrollments-table");
  wrap.innerHTML = '<div class="loading-state">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db, "enrollments"), orderBy("createdAt", "desc")));
    allEnrollments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Populate course filter dropdown for enrollments
    const enrollCourseFilter = document.getElementById("adm-enroll-course-filter");
    if (enrollCourseFilter) {
      const courseNames = [...new Set(allEnrollments.map(e => e.courseName).filter(Boolean))].sort();
      enrollCourseFilter.innerHTML = '<option value="">All Courses</option>' +
        courseNames.map(n => `<option value="${n}">${n}</option>`).join("");
    }

    renderAdminEnrollmentsTable(allEnrollments);
  } catch (err) { wrap.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`; }
};

window.filterAdminEnrollments = () => {
  const status = document.getElementById("adm-enroll-status-filter").value;
  const course = document.getElementById("adm-enroll-course-filter").value;
  const filtered = allEnrollments.filter(e =>
    (!status || e.status    === status) &&
    (!course || e.courseName === course)
  );
  renderAdminEnrollmentsTable(filtered);
};

function renderAdminEnrollmentsTable(enrollments) {
  const wrap = document.getElementById("admin-enrollments-table");
  if (!enrollments.length) { wrap.innerHTML = '<div class="empty-state">No enrollments found.</div>'; return; }
  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Student</th><th>Email</th><th>Course</th><th>Code</th><th>Status</th><th>Date</th><th>Actions</th>
    </tr></thead>
    <tbody>${enrollments.map(e => `<tr>
      <td>${e.studentName}</td>
      <td>${e.studentEmail}</td>
      <td>${e.courseName}</td>
      <td>${e.courseCode}</td>
      <td><span class="status-badge ${e.status}">${e.status}</span></td>
      <td>${formatDate(e.createdAt)}</td>
      <td>
        <button class="btn-action btn-view" onclick="viewStudent('${e.studentId}')">View</button>
        ${e.status === "pending" ? `
          <button class="btn-action btn-approve" onclick="approveEnrollment('${e.id}')">Approve</button>
          <button class="btn-action btn-reject"  onclick="rejectEnrollment('${e.id}')">Reject</button>
        ` : `<span style="color:var(--text-muted);font-size:13px">${e.status}</span>`}
      </td>
    </tr>`).join("")}</tbody>
  </table>`;
}

// ─── APPROVE ENROLLMENT ───────────────────────────────────
// Refresh all three admin panels in parallel after any enrollment change
async function refreshAdminDashboard() {
  await Promise.all([loadAdminOverview(), loadAdminEnrollments(), loadAdminCourses()]);
}

window.approveEnrollment = async (enrollmentId) => {
  try {
    const snap = await getDoc(doc(db, "enrollments", enrollmentId));
    if (!snap.exists()) return;
    const enrollment = snap.data();

    await updateDoc(doc(db, "enrollments", enrollmentId), {
      status: "approved",
      approvedAt: serverTimestamp(),
    });

    // Atomically increment course enrolled count (avoids race condition)
    const courseRef = doc(db, "courses", enrollment.courseId);
    await updateDoc(courseRef, { enrolled: increment(1) });

    // Send confirmation email via EmailJS
    await sendApprovalEmail(enrollment);

    showToast(`✓ Enrollment approved for ${enrollment.studentName}`, "success");
    refreshAdminDashboard();
  } catch (err) { showToast("Error: " + err.message, "error"); }
};

// ─── REJECT ENROLLMENT ────────────────────────────────────
window.rejectEnrollment = async (enrollmentId) => {
  if (!confirm("Reject this enrollment request?")) return;
  try {
    await updateDoc(doc(db, "enrollments", enrollmentId), {
      status: "rejected",
      rejectedAt: serverTimestamp(),
    });
    showToast("Enrollment rejected.", "warning");
    refreshAdminDashboard();
  } catch (err) { showToast("Error: " + err.message, "error"); }
};

// ─── SEND EMAIL VIA EMAILJS ──────────────────────────────
async function sendApprovalEmail(enrollment) {
  if (!window.emailjs) { console.warn("EmailJS not loaded"); return; }
  try {
    await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      student_name:     enrollment.studentName,
      student_email:    enrollment.studentEmail,
      course_name:      enrollment.courseName,
      course_code:      enrollment.courseCode,
      course_schedule:  enrollment.schedule || "TBA",
      course_instructor: enrollment.instructor || "TBA",
      portal_url:       DEPLOYMENT.vercelUrl,
    });
    console.log("Confirmation email sent to", enrollment.studentEmail);
  } catch (err) {
    console.warn("EmailJS send failed:", err);
    // Don't block the approval flow if email fails
  }
}

// ─── REPORTS ──────────────────────────────────────────────
async function reportEnrollmentSummary() {
  const snap = await getDocs(collection(db, "enrollments"));
  let pending = 0, approved = 0, rejected = 0;
  const deptMap = {};
  snap.forEach(d => {
    const e = d.data();
    if (e.status === "pending")  pending++;
    if (e.status === "approved") approved++;
    if (e.status === "rejected") rejected++;
    deptMap[e.program] = (deptMap[e.program] || 0) + 1;
  });
  return `
    <h3>📊 Enrollment Summary</h3>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Generated ${new Date().toLocaleString()}</p>
    <div class="stats-row" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-card-icon amber">◎</div><div><div class="stat-card-num">${pending}</div><div class="stat-card-label">Pending</div></div></div>
      <div class="stat-card"><div class="stat-card-icon green">✦</div><div><div class="stat-card-num">${approved}</div><div class="stat-card-label">Approved</div></div></div>
      <div class="stat-card"><div class="stat-card-icon" style="background:var(--red-light);color:var(--red)">✕</div><div><div class="stat-card-num">${rejected}</div><div class="stat-card-label">Rejected</div></div></div>
    </div>
    <table class="report-table">
      <thead><tr><th>Program</th><th>Total Enrollments</th></tr></thead>
      <tbody>${Object.entries(deptMap).map(([d,c]) => `<tr><td>${d||"Unknown"}</td><td>${c}</td></tr>`).join("")}</tbody>
    </table>`;
}

async function reportCourseCapacity() {
  const snap = await getDocs(collection(db, "courses"));
  const courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return `
    <h3>📈 Course Capacity Report</h3>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Generated ${new Date().toLocaleString()}</p>
    <table class="report-table">
      <thead><tr><th>Code</th><th>Course</th><th>Program</th><th>Enrolled</th><th>Capacity</th><th>Available</th><th>Fill %</th></tr></thead>
      <tbody>${courses.map(c => {
        const pct = Math.round(((c.enrolled||0)/(c.capacity||1))*100);
        const avail = (c.capacity||0) - (c.enrolled||0);
        return `<tr>
          <td>${c.code}</td><td>${c.name}</td><td>${c.program||"—"}</td>
          <td>${c.enrolled||0}</td><td>${c.capacity}</td>
          <td style="color:${avail<=0?"var(--red)":"var(--green)"}">${avail}</td>
          <td><div class="capacity-bar" style="width:80px;display:inline-block"><div class="capacity-fill ${pct>=100?"full":pct>=80?"warn":""}" style="width:${Math.min(pct,100)}%"></div></div> ${pct}%</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

async function reportStudentList() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return `
    <h3>📋 Student Directory</h3>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Total: ${students.length} students · Generated ${new Date().toLocaleString()}</p>
    <table class="report-table">
      <thead><tr><th>Name</th><th>Email</th><th>Student ID</th><th>Program</th><th>Phone</th><th>Registered</th></tr></thead>
      <tbody>${students.map(s => `<tr>
        <td>${s.firstName} ${s.lastName}</td>
        <td>${s.email}</td>
        <td>${s.studentId||"—"}</td>
        <td>${s.program||"—"}</td>
        <td>${s.phone||"—"}</td>
        <td>${formatDate(s.createdAt)}</td>
      </tr>`).join("")}</tbody>
    </table>`;
}

async function reportDepartmentStats() {
  const [studSnap, courseSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), where("role","==","student"))),
    getDocs(collection(db, "courses")),
  ]);
  const deptStudents = {}, deptCourses = {};
  studSnap.forEach(d => {
    const dept = d.data().program || "Unknown";
    deptStudents[dept] = (deptStudents[dept] || 0) + 1;
  });
  courseSnap.forEach(d => {
    const dept = d.data().program || "Unknown";
    deptCourses[dept] = (deptCourses[dept] || 0) + 1;
  });
  const depts = new Set([...Object.keys(deptStudents), ...Object.keys(deptCourses)]);
  return `
    <h3>🏛 Program Statistics</h3>
    <p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">Generated ${new Date().toLocaleString()}</p>
    <table class="report-table">
      <thead><tr><th>Program</th><th>Students</th><th>Courses</th></tr></thead>
      <tbody>${[...depts].sort().map(d => `<tr>
        <td>${d}</td>
        <td>${deptStudents[d]||0}</td>
        <td>${deptCourses[d]||0}</td>
      </tr>`).join("")}</tbody>
    </table>`;
}

window.generateReport = async (type) => {
  const output = document.getElementById("report-output");
  output.classList.remove("hidden");
  output.innerHTML = '<div class="loading-state">Generating report…</div>';
  try {
    const reportFns = {
      "enrollment-summary": reportEnrollmentSummary,
      "course-capacity":    reportCourseCapacity,
      "student-list":       reportStudentList,
      "department-stats":   reportDepartmentStats,
    };
    const fn = reportFns[type];
    if (!fn) return;
    output.innerHTML = await fn();
    output.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    output.innerHTML = `<div class="empty-state">Error generating report: ${err.message}</div>`;
  }
};

// ═══════════════════════════════════════════════════════════
//  AUTH ERROR MESSAGES
// ═══════════════════════════════════════════════════════════
function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use":   "This email is already registered.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password is too weak (min 8 characters).",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/too-many-requests":      "Too many failed attempts. Please try again later.",
    "auth/requires-recent-login":  "Please log out and log back in to change your password.",
  };
  return map[code] || "An error occurred. Please try again.";
}

// ═══════════════════════════════════════════════════════════
//  CLOSE MODALS ON OVERLAY CLICK
// ═══════════════════════════════════════════════════════════
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});
