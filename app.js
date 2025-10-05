// DOM refs
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const repInfo = document.getElementById("rep-info");
const title = document.getElementById("exercise-title");

// Screens
const introScreen = document.getElementById("intro-screen");
const selectionScreen = document.getElementById("selection-screen");
const exerciseScreen = document.getElementById("exercise-screen");

// Report modal
const reportModal = document.getElementById("report-modal");
const reportSummary = document.getElementById("report-summary");
const exportPdfBtn = document.getElementById("export-pdf-btn");
const closeReportBtn = document.getElementById("close-report-btn");

// Session state
let repCount = 0;
let inPosition = false;
let currentExercise = "none";
let startTime;
let camera;
let lastSession = null;

// ===== Navigation =====
function goToSelection() {
  introScreen.classList.add("hidden");
  selectionScreen.classList.remove("hidden");
}

function goBackToIntro() {
  selectionScreen.classList.add("hidden");
  introScreen.classList.remove("hidden");
}

function startExercise(exercise) {
  currentExercise = exercise;
  repCount = 0;
  inPosition = false;
  startTime = Date.now();
  title.textContent = `Exercise: ${exercise}`;
  repInfo.textContent = `Reps: 0`;

  selectionScreen.classList.add("hidden");
  exerciseScreen.classList.remove("hidden");

  startCamera();
}

function endExercise() {
  const durationSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  lastSession = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    day: new Date().toISOString().split("T")[0],
    exercise: currentExercise,
    reps: repCount,
    duration: `${minutes}m ${seconds}s`,
  };

  saveProgress(lastSession);
  stopCamera();

  // Show report modal
  reportSummary.textContent = `Exercise: ${lastSession.exercise} • Reps: ${lastSession.reps} • Duration: ${lastSession.duration}`;
  reportModal.showModal();

  exerciseScreen.classList.add("hidden");
  selectionScreen.classList.remove("hidden");
}

function stopCamera() {
  try {
    camera?.stop();
  } catch {}
}

// ===== Exercise Logic =====
function calculateAngle(a, b, c) {
  const AB = { x: a.x - b.x, y: a.y - b.y };
  const CB = { x: c.x - b.x, y: c.y - b.y };
  const dot = AB.x * CB.x + AB.y * CB.y;
  const magAB = Math.hypot(AB.x, AB.y);
  const magCB = Math.hypot(CB.x, CB.y);
  return (Math.acos(dot / (magAB * magCB)) * 180) / Math.PI;
}

const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 0,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) return;
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });
  drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 1 });

  const lm = results.poseLandmarks;

  // Double Arm
  if (currentExercise === "doubleArm") {
    const lW = lm[15], rW = lm[16];
    const shoulderY = (lm[11].y + lm[12].y) / 2;
    if (lW.y < shoulderY && rW.y < shoulderY) countRep(); else inPosition = false;
  }

  // Left Arm
  if (currentExercise === "leftArm") {
    const w = lm[15], s = lm[11];
    if (w.y < s.y) countRep(); else inPosition = false;
  }

  // Right Arm
  if (currentExercise === "rightArm") {
    const w = lm[16], s = lm[12];
    if (w.y < s.y) countRep(); else inPosition = false;
  }

  // Left Leg
  if (currentExercise === "leftLeg") {
    const a = lm[27], k = lm[25];
    if (a.y < k.y * 1.05) countRep(); else inPosition = false;
  }

  // Right Leg
  if (currentExercise === "rightLeg") {
    const a = lm[28], k = lm[26];
    if (a.y < k.y * 1.05) countRep(); else inPosition = false;
  }

  // Body Tilt
  if (currentExercise === "tilt") {
    const headX = lm[0].x;
    const shouldersX = (lm[11].x + lm[12].x) / 2;
    if (Math.abs(headX - shouldersX) > 0.05) countRep();
    else inPosition = false;
  }

  // Squats
  if (currentExercise === "squats") {
    const leftAngle = calculateAngle(lm[23], lm[25], lm[27]);
    const rightAngle = calculateAngle(lm[24], lm[26], lm[28]);
    const avgKneeAngle = (leftAngle + rightAngle) / 2;
    if (avgKneeAngle < 140) countRep();
    else if (avgKneeAngle > 160) inPosition = false;

    ctx.fillStyle = "crimson";
    ctx.font = "16px system-ui";
    ctx.fillText(`Knee Angle: ${Math.round(avgKneeAngle)}°`, 16, 24);
  }
});

function countRep() {
  if (!inPosition) {
    repCount++;
    repInfo.textContent = `Reps: ${repCount}`;
    inPosition = true;
  }
}

function startCamera() {
  camera = new Camera(video, {
    onFrame: async () => await pose.send({ image: video }),
    width: 640,
    height: 480,
  });
  camera.start();
}

// ===== Progress & Streak (localStorage) =====
function saveProgress(session) {
  const progress = JSON.parse(localStorage.getItem("progress") || "[]");
  progress.push(session);
  localStorage.setItem("progress", JSON.stringify(progress));
  updateStreak(session.day);
}

function updateStreak(todayStr) {
  let sd = JSON.parse(localStorage.getItem("streakData") || "{}");
  const prev = sd.lastDate;
  if (!prev) {
    sd = { streak: 1, lastDate: todayStr };
  } else {
    const prevDate = new Date(prev);
    const today = new Date(todayStr);
    const diffDays = Math.round((today - prevDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) sd.streak = (sd.streak || 0) + 1;
    else if (diffDays > 1) sd.streak = 1;
    sd.lastDate = todayStr;
  }
  localStorage.setItem("streakData", JSON.stringify(sd));
}

// ===== Report modal controls =====
closeReportBtn.addEventListener("click", () => reportModal.close());
exportPdfBtn.addEventListener("click", async () => {
  if (!lastSession) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Rehab Quest - Session Report", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Date: ${new Date(lastSession.date).toLocaleString()}`, 14, 32);
  doc.text(`Exercise: ${lastSession.exercise}`, 14, 40);
  doc.text(`Reps: ${lastSession.reps}`, 14, 48);
  doc.text(`Duration: ${lastSession.duration}`, 14, 56);

  doc.save(`rehab-session-${lastSession.id}.pdf`);
});

// Expose nav functions to HTML
window.goToSelection = goToSelection;
window.goBackToIntro = goBackToIntro;
window.startExercise = startExercise;
window.endExercise = endExercise;
