// ✅ TYPE-ONLY IMPORT
import type { User, Draw, Bet, Transaction, Game } from './types';

// Base URL
const BASE_URL = 'https://luckyball.in/api';
// const BASE_URL = 'http://localhost:3001/api';

// Helper
const buildUrl = (endpoint: string) =>
  `${BASE_URL}/${endpoint.replace(/^\/+/, '')}`;

// Fetch with timeout
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout = 15000
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// Handle JSON safely
const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
};

// API wrapper
export const api = {
  // ---------- GENERIC ----------
  async get(endpoint: string) {
    const res = await fetchWithTimeout(buildUrl(endpoint));
    return handleResponse(res);
  },
 

  async post(endpoint: string, data?: any) {
    const res = await fetchWithTimeout(buildUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse(res);
  },

  async delete(endpoint: string) {
    const res = await fetchWithTimeout(buildUrl(endpoint), {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  // ---------- GAMES (🔥 REQUIRED FOR ADMIN.tsx) ----------
  async createGame(data: {
    drawId: string;
    poolName: string;
    gameType: string;
    entryFee: number;
    prize: number[];
  }) {
    const res = await fetchWithTimeout(buildUrl('/admin/games'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getGamesForDraw(drawId: string): Promise<Game[]> {
    const res = await fetchWithTimeout(buildUrl(`/admin/games/${drawId}`));
    return handleResponse(res);
  },


  async deleteGame(gameId: string) {
    const res = await fetchWithTimeout(buildUrl(`/admin/games/${gameId}`), {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async finalizeGame(gameId: string, winningNumbers: number[]) {
    const res = await fetchWithTimeout(buildUrl('/admin/games/finalize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, winningNumbers }),
    });
    return handleResponse(res);
  },
};
