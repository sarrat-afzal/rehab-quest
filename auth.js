(function(){
  const USER_KEY = "rq_user";

  function getCurrentUser(){
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  }

  function setUser(name, email){
    const user = { name: String(name || "").trim(), email: String(email || "").trim() };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  function logout(){
    localStorage.removeItem(USER_KEY);
    window.location.href = "login.html";
  }

  function isLoginPage(){
    return /(^|\/)login\.html?$/.test(window.location.pathname);
  }

  function isLandingPage(){
    const p = window.location.pathname;
    return p === '/' || /(^|\/)index\.html?$/.test(p);
  }

  function requireAuth(){
    const user = getCurrentUser();
    if (!user || !user.name) {
      if (!isLoginPage()) {
        window.location.href = "login.html";
      }
      return false;
    }
    // If on login page and already logged in, go to app
    if (isLoginPage()) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  function getInitials(name){
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length-1][0] : "";
    return (first + last).toUpperCase();
  }

  function initAuthHeader(){
    const user = getCurrentUser();
    const badge = document.getElementById("user-badge");
    const logoutBtn = document.getElementById("logout-btn");
    if (badge && user && user.name) {
      badge.textContent = getInitials(user.name);
      badge.title = user.name;
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }
  }

  // Expose
  window.RQAuth = { getCurrentUser, setUser, logout, requireAuth, initAuthHeader };

  document.addEventListener("DOMContentLoaded", function(){
    // Only enforce auth on non-viewer, non-login pages
    const isViewer = /(^|\/)viewer\.html?$/.test(window.location.pathname);
    if (!isViewer) {
      if (!isLoginPage() && !isLandingPage()) {
        if (!requireAuth()) return; // redirects if needed
      }
      // on login, if already logged in, requireAuth will redirect; else landing is public
    }
    initAuthHeader();
  });
})();
