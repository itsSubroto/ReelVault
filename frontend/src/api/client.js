const API_BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.message || err.error || errorMsg;
    } catch {
      // fallback to status text
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Collections
  async getCollections() {
    const res = await fetch(`${API_BASE}/collections`);
    return handleResponse(res);
  },

  async createCollection(name, description = '') {
    const res = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return handleResponse(res);
  },

  async deleteCollection(id) {
    const res = await fetch(`${API_BASE}/collections/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Reels
  async getReels(collectionId = null) {
    const url = collectionId 
      ? `${API_BASE}/reels?collectionId=${collectionId}` 
      : `${API_BASE}/reels`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  async saveReel(url, collectionId) {
    const res = await fetch(`${API_BASE}/reels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, collectionId }),
    });
    return handleResponse(res);
  },

  async deleteReel(id) {
    const res = await fetch(`${API_BASE}/reels/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // Search
  async search(query, collectionId = null) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (collectionId) params.set('collectionId', collectionId);

    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    return handleResponse(res);
  },
};
