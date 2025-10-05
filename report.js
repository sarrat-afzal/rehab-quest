const preview = document.getElementById("preview");
const exportAllBtn = document.getElementById("export-all-pdf");
const clearBtn = document.getElementById("clear-data");

const progress = JSON.parse(localStorage.getItem("progress") || "[]");
const streakData = JSON.parse(localStorage.getItem("streakData") || "{}");

// Preview table
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
