// DOM refs
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const repInfo = document.getElementById("rep-info");
const title = document.getElementById("exercise-title");
if (repInfo) repInfo.classList.add('rep-info-animated');

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
let targetReps = 0;
let targetSets = 0;
let currentSet = 1;
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
  // Read targets
  const repsInput = document.getElementById("target-reps");
  const setsInput = document.getElementById("target-sets");
  targetReps = Math.max(0, parseInt(repsInput?.value || "0", 10) || 0);
  targetSets = Math.max(0, parseInt(setsInput?.value || "0", 10) || 0);
  currentSet = 1;
  title.textContent = `Exercise: ${exercise}`;
  repInfo.textContent = targetSets > 0 && targetReps > 0
    ? `Set ${currentSet}/${targetSets} • Reps: 0/${targetReps}`
    : `Reps: 0`;
  // create/set progress bar under repInfo
  let prog = document.getElementById('set-progress');
  if (!prog) {
    prog = document.createElement('div');
    prog.id = 'set-progress';
    prog.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    prog.appendChild(bar);
    const header = exerciseScreen.querySelector('.card-header');
    header?.insertAdjacentElement('afterend', prog);
  }
  updateSetProgress();

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
  const mirror = localStorage.getItem('rq_mirror') === '1';
  if (mirror) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  }

  if (!results.poseLandmarks) return;
  const showGuides = localStorage.getItem('rq_guides') !== '0';
  if (showGuides) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: "#34d399", lineWidth: 2 });
    drawLandmarks(ctx, results.poseLandmarks, { color: "#ef4444", lineWidth: 1 });
  }

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
    if (repInfo) { repInfo.classList.remove('pulse'); void repInfo.offsetWidth; repInfo.classList.add('pulse'); }
    const sound = localStorage.getItem('rq_sound') === '1';
    if (sound) {
      try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAZGF0YQAAAAA=').play(); } catch {}
    }
    if (targetSets > 0 && targetReps > 0) {
      const repsInSet = repCount % targetReps || targetReps;
      const setNum = Math.ceil(repCount / targetReps);
      currentSet = Math.min(setNum, targetSets);
      repInfo.textContent = `Set ${currentSet}/${targetSets} • Reps: ${repsInSet}/${targetReps}`;
      if (repsInSet === targetReps && currentSet < targetSets) {
        // brief toast
        showToast(`Set ${currentSet} complete!`);
      }
      if (repCount >= targetReps * targetSets) {
        showToast("All sets complete!", 1200);
        setTimeout(() => endExercise(), 800);
      }
    } else {
      repInfo.textContent = `Reps: ${repCount}`;
    }
    updateSetProgress();
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

// Lightweight toast
let toastTimeout;
function showToast(message, time=900){
  let el = document.getElementById('toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.background = 'rgba(15,18,34,0.9)';
    el.style.color = '#fff';
    el.style.padding = '10px 14px';
    el.style.borderRadius = '10px';
    el.style.boxShadow = '0 6px 16px rgba(0,0,0,.2)';
    el.style.zIndex = '2000';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=>{ el.style.opacity='0'; }, time);
}

function updateSetProgress(){
  const bar = document.querySelector('#set-progress .bar');
  if (!bar) return;
  if (targetSets > 0 && targetReps > 0) {
    const repsInSet = repCount % targetReps;
    const pct = Math.min(100, Math.round((repsInSet / targetReps) * 100));
    bar.style.width = pct + '%';
  } else {
    bar.style.width = '0%';
  }
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

// ===== UI toggles =====
document.addEventListener('DOMContentLoaded', () => {
  const mirrorBtn = document.getElementById('toggle-mirror');
  const guidesBtn = document.getElementById('toggle-guides');
  const soundBtn = document.getElementById('toggle-sound');
  const applyState = () => {
    if (mirrorBtn) mirrorBtn.classList.toggle('active', localStorage.getItem('rq_mirror') === '1');
    if (guidesBtn) guidesBtn.classList.toggle('active', localStorage.getItem('rq_guides') !== '0');
    if (soundBtn) soundBtn.classList.toggle('active', localStorage.getItem('rq_sound') === '1');
  };
  mirrorBtn?.addEventListener('click', () => { localStorage.setItem('rq_mirror', localStorage.getItem('rq_mirror') === '1' ? '0' : '1'); applyState(); });
  guidesBtn?.addEventListener('click', () => { localStorage.setItem('rq_guides', localStorage.getItem('rq_guides') === '0' ? '1' : '0'); applyState(); });
  soundBtn?.addEventListener('click', () => { localStorage.setItem('rq_sound', localStorage.getItem('rq_sound') === '1' ? '0' : '1'); applyState(); });
  applyState();
});
