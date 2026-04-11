const API = '/api';

function setStatus(message, isError = false) {
  const el = document.getElementById('admin-login-status');
  if (!el) return;
  el.textContent = message;
  el.className = `status ${isError ? 'error' : 'ok'}`;
}

function getSafeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get('next');
  if (nextPath && nextPath.startsWith('/')) {
    return nextPath;
  }
  return '/admin.html';
}

async function checkConfigAndSession() {
  try {
    const statusRes = await fetch(`${API}/admin/status`);
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (!status.configured) {
        const submitBtn = document.getElementById('admin-login-submit');
        if (submitBtn) submitBtn.disabled = true;
        setStatus('Sécurité admin non configurée. Ajoutez les variables serveur requises.', true);
        return;
      }
    }

    const meRes = await fetch(`${API}/admin/me`);
    if (meRes.ok) {
      window.location.replace(getSafeNextPath());
    }
  } catch {
    setStatus('Serveur indisponible.', true);
  }
}

async function submitLogin(event) {
  event.preventDefault();

  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;

  if (!username || !password) {
    setStatus('Renseignez vos identifiants.', true);
    return;
  }

  setStatus('Connexion en cours...');

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.error || 'Connexion refusée.');
    }

    setStatus('Connexion réussie.');
    window.location.replace(getSafeNextPath());
  } catch (err) {
    setStatus(err.message || 'Connexion impossible.', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkConfigAndSession();
  const form = document.getElementById('admin-login-form');
  if (form) form.addEventListener('submit', submitLogin);
});
