const preview = document.getElementById("preview");
const exportAllBtn = document.getElementById("export-all-pdf");
const clearBtn = document.getElementById("clear-data");
const sessionsEl = document.getElementById("sessionsChart");
const mixEl = document.getElementById("mixChart");
const streakBar = document.getElementById("streakBarReport");

const progress = JSON.parse(localStorage.getItem("progress") || "[]");
const streakData = JSON.parse(localStorage.getItem("streakData") || "{}");

// Preview table
if (streakBar) {
  const streak = (streakData.streak || 0);
  const capped = Math.min(30, streak);
  const pct = Math.round((capped / 30) * 100);
  streakBar.style.width = pct + '%';
}

if (progress.length === 0) {
  preview.innerHTML = '<p class="muted">No sessions available.</p>';
} else {
  const rows = progress
    .slice().reverse()
    .map(s => `
      <div class="row table-row">
        <div>${new Date(s.date).toLocaleString()}</div>
        <div>${s.exercise}</div>
        <div>${s.reps} reps</div>
        <div>${s.duration}</div>
      </div>
    `).join("");

  preview.innerHTML = `
    <div class="row table-head">
      <div>Date</div><div>Exercise</div><div>Reps</div><div>Duration</div>
    </div>
    ${rows}
  `;
}

// Charts
if (sessionsEl) {
  const byDay = progress.reduce((m, s) => { m[s.day] = (m[s.day] || 0) + 1; return m; }, {});
  const dayLabels = Object.keys(byDay).sort();
  const dayCounts = dayLabels.map(d => byDay[d]);
  new Chart(sessionsEl, {
    type: 'line',
    data: { labels: dayLabels, datasets: [{ label: 'Sessions', data: dayCounts, tension: 0.3 }]},
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

if (mixEl) {
  const byExercise = progress.reduce((m, s) => { m[s.exercise] = (m[s.exercise] || 0) + (s.reps || 0); return m; }, {});
  const exLabels = Object.keys(byExercise);
  const exCounts = exLabels.map(k => byExercise[k]);
  new Chart(mixEl, {
    type: 'bar',
    data: { labels: exLabels, datasets: [{ label: 'Total Reps', data: exCounts }]},
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

// Export all sessions as PDF
exportAllBtn.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Rehab Quest - Full Progress Report", 14, 16);

  // Stats
  const totalSessions = progress.length;
  const totalReps = progress.reduce((s, p) => s + (p.reps || 0), 0);
  const streak = streakData.streak || 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
  doc.text(`Total Sessions: ${totalSessions}`, 14, 34);
  doc.text(`Total Reps: ${totalReps}`, 14, 42);
  doc.text(`Current Streak: ${streak} days`, 14, 50);

  // Shareable viewer link
  try {
    const user = JSON.parse(localStorage.getItem('rq_user')||'null');
    const payload = {
      user,
      progress,
      streakData,
      generatedAt: Date.now()
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const shareUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}viewer.html?data=${b64}`;
    doc.textWithLink('Open in Clinician Viewer', 14, 58, { url: shareUrl });
  } catch {}

  // Table header
  let y = 64;
  doc.setFont("helvetica", "bold");
  doc.text("Date", 14, y);
  doc.text("Exercise", 74, y);
  doc.text("Reps", 124, y);
  doc.text("Duration", 154, y);
  doc.setFont("helvetica", "normal");

  y += 6;
  progress.forEach((s) => {
    const line = [
      new Date(s.date).toLocaleString(),
      s.exercise,
      String(s.reps),
      s.duration,
    ];

    // Wrap basic pagination
    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    doc.text(line[0], 14, y);
    doc.text(line[1], 74, y);
    doc.text(line[2], 124, y);
    doc.text(line[3], 154, y);
    y += 6;
  });

  doc.save(`rehab-quest-report-${Date.now()}.pdf`);
});

// Danger: clear local data
clearBtn.addEventListener("click", () => {
  if (!confirm("This will delete your local progress & streak. Continue?")) return;
  localStorage.removeItem("progress");
  localStorage.removeItem("streakData");
  location.reload();
});
