const API_BASE = '/api';

const TOKEN_KEY = 'reelvault_token';

let authToken = localStorage.getItem(TOKEN_KEY) || null;

export const setToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getToken = () => authToken;

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.message || err.error || errorMsg;
    } catch {
      // fallback to status text
    }
    if (res.status === 401) {
      setToken(null);
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Authentication
  async register(username, email, password, name = '') {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, name }),
    });
    const data = await handleResponse(res);
    if (data && data.token) {
      setToken(data.token);
    }
    return data;
  },

  async login(usernameOrEmail, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    const data = await handleResponse(res);
    if (data && data.token) {
      setToken(data.token);
    }
    return data;
  },

  async getMe() {
    if (!authToken) return null;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  logout() {
    setToken(null);
  },

  // Collections
  async getCollections() {
    const res = await fetch(`${API_BASE}/collections`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createCollection(name, description = '') {
    const res = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, description }),
    });
    return handleResponse(res);
  },

  async deleteCollection(id) {
    const res = await fetch(`${API_BASE}/collections/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Reels
  async getReels(collectionId = null) {
    const url = collectionId 
      ? `${API_BASE}/reels?collectionId=${collectionId}` 
      : `${API_BASE}/reels`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async saveReel(url, collectionId) {
    const res = await fetch(`${API_BASE}/reels`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url, collectionId }),
    });
    return handleResponse(res);
  },

  async deleteReel(id) {
    const res = await fetch(`${API_BASE}/reels/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Search
  async search(query, collectionId = null) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (collectionId) params.set('collectionId', collectionId);

    const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // AI Processing & Sync
  async processReel(id) {
    const res = await fetch(`${API_BASE}/reels/${id}/process`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async syncAllReels() {
    const res = await fetch(`${API_BASE}/reels/sync-all`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};
