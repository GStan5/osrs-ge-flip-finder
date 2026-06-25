(function () {
  async function initAuth() {
    const slot = document.getElementById("authSlot");
    if (!slot) return;

    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      const data = await res.json();

      if (data.user) {
        const pro = data.pro ? ' <span class="nav-badge">Pro</span>' : "";
        slot.innerHTML = `<span class="auth-user">${escapeHtml(data.user.username || "Player")}${pro}</span>
          <a href="/api/auth/logout">Sign out</a>`;
      } else {
        slot.innerHTML = `<a href="/api/auth/discord" class="auth-login">Sign in</a>`;
      }
    } catch {
      slot.innerHTML = `<a href="/api/auth/discord" class="auth-login">Sign in</a>`;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
