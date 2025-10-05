(function(){
  const THEME_KEY = 'rq_theme';

  function applyTheme(theme){
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById('theme-toggle');
    if (btn){
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
    // Swap Lottie sources for dark/light themes
    document.querySelectorAll('lottie-player').forEach((el) => {
      const src = theme === 'dark' ? el.getAttribute('data-src-dark') : el.getAttribute('data-src-light');
      if (src && el.getAttribute('src') !== src) {
        el.setAttribute('src', src);
      }
    });
  }

  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
    const btn = document.getElementById('theme-toggle');
    if (btn){
      btn.addEventListener('click', () => {
        const next = (localStorage.getItem(THEME_KEY) || 'light') === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }
    // Improve brand accessibility: clicking brand goes home
    const brand = document.querySelector('.brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', () => { window.location.href = 'index.html'; });
    }
  }

  document.addEventListener('DOMContentLoaded', initTheme);
  window.RQUI = { applyTheme };
})();
