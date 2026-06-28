const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

// Access token kept in module scope (not localStorage) per app convention.
let accessToken = null;

export function setToken(token) {
  accessToken = token;
  // Persist lightly so a refresh keeps you logged in (dev convenience).
  if (token) localStorage.setItem('specgen_token', token);
  else localStorage.removeItem('specgen_token');
}

export function loadToken() {
  accessToken = localStorage.getItem('specgen_token');
  return accessToken;
}

async function request(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // CSRF convention header used across the app's APIs.
  if (method !== 'GET') headers['X-Requested-With'] = 'XMLHttpRequest';

  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });

  if (res.status === 204) return null;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),

  listSpecs: () => request('/specs'),
  createSpec: (b) => request('/specs', { method: 'POST', body: b }),
  createSpecFromFile: (form) =>
    request('/specs', { method: 'POST', body: form, isForm: true }),
  getSpec: (id) => request(`/specs/${id}`),
  updateSpec: (id, b) => request(`/specs/${id}`, { method: 'PUT', body: b }),
  deleteSpec: (id) => request(`/specs/${id}`, { method: 'DELETE' }),
  getQuestions: (id) => request(`/specs/${id}/questions`, { method: 'POST' }),
  reviewSpec: (id, b) => request(`/specs/${id}/review`, { method: 'POST', body: b }),
  rewriteSpec: (id, b) => request(`/specs/${id}/rewrite`, { method: 'POST', body: b }),
  listVersions: (id) => request(`/specs/${id}/versions`),
  getVersion: (id, vid) => request(`/specs/${id}/versions/${vid}`),
  revertVersion: (id, vid) =>
    request(`/specs/${id}/versions/${vid}/revert`, { method: 'POST' }),

  // Catalogue (Phase 2): archetypes + blueprints, Mode B classification.
  getCatalogue: () => request('/catalogue'),
  // Live, zero-LLM keyword lookup used by the draft editor as the user types.
  matchCatalogue: (b) => request('/catalogue/match', { method: 'POST', body: b }),
  // Existing-project deep-read: derive stack + already-delivered requirements.
  ingestRepo: (id) => request(`/specs/${id}/ingest-repo`, { method: 'POST' }),
  classifySpec: (id, b) => request(`/specs/${id}/classify`, { method: 'POST', body: b }),
  getSpecArchetypes: (id) => request(`/specs/${id}/archetypes`),
  decideArchetype: (id, archetypeId, status) =>
    request(`/specs/${id}/archetypes/${archetypeId}`, { method: 'PATCH', body: { status } }),

  // Fetch an exported markdown file (auth header required) and trigger a download.
  // kind: 'export' = review report, 'export-spec' = rewritten structured spec.
  async download(id, title, kind = 'export', suffix = '') {
    const res = await fetch(`${BASE_URL}/specs/${id}/${kind}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(JSON.parse(t || '{}').message || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'spec').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${suffix}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  downloadExport(id, title) {
    return this.download(id, title, 'export', '');
  },
  downloadSpec(id, title) {
    return this.download(id, title, 'export-spec', '-spec');
  },
};

export { BASE_URL };
