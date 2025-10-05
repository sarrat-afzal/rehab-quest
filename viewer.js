(function(){
  function decodeDataParam(){
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    if (!data) return null;
    try {
      const json = decodeURIComponent(escape(atob(data)));
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to decode data:', e);
      return null;
    }
  }

  const payload = decodeDataParam();
  if (!payload){
    document.getElementById('viewer-title').textContent = 'No data provided';
    document.getElementById('viewer-meta').textContent = 'Open a shared link from Rehab Quest.';
    return;
  }

  const userName = (payload.user && payload.user.name) || 'Patient';
  const progress = Array.isArray(payload.progress) ? payload.progress : [];
  const streakData = payload.streakData || {};
  const generatedAt = payload.generatedAt ? new Date(payload.generatedAt).toLocaleString() : '';

  document.getElementById('viewer-title').textContent = `Shared Progress for ${userName}`;
  document.getElementById('viewer-meta').textContent = `Generated: ${generatedAt} • Sessions: ${progress.length} • Current streak: ${streakData.streak || 0} days`;

  // Charts
  const byDay = progress.reduce((m, s) => { m[s.day] = (m[s.day] || 0) + 1; return m; }, {});
  const dayLabels = Object.keys(byDay).sort();
  const dayCounts = dayLabels.map(d => byDay[d]);
  new Chart(document.getElementById('sessionsChart'), {
    type: 'line',
    data: { labels: dayLabels, datasets: [{ label: 'Sessions', data: dayCounts, tension: 0.3 }]},
    options: { plugins: { legend: { display: false }}, scales: { y: { beginAtZero: true, ticks: { precision: 0 }}}}
  });

  const byExercise = progress.reduce((m, s) => { m[s.exercise] = (m[s.exercise] || 0) + (s.reps || 0); return m; }, {});
  const exLabels = Object.keys(byExercise);
  const exCounts = exLabels.map(k => byExercise[k]);
  new Chart(document.getElementById('mixChart'), {
    type: 'bar',
    data: { labels: exLabels, datasets: [{ label: 'Total Reps', data: exCounts }]},
    options: { plugins: { legend: { display: false }}, scales: { y: { beginAtZero: true, ticks: { precision: 0 }}}}
  });

  // History table
  const history = document.getElementById('history');
  if (progress.length === 0) {
    history.innerHTML = '<p class="muted">No sessions available.</p>';
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
      `).join('');
    history.innerHTML = `
      <div class="row table-head">
        <div>Date</div><div>Exercise</div><div>Reps</div><div>Duration</div>
      </div>
      ${rows}
    `;
  }
})();
