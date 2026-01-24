// ✅ TYPE-ONLY IMPORT (CRITICAL)
import type { User, Draw, Bet, Transaction } from './types';

// Base URL
const BASE_URL =
  location.hostname === 'localhost'
    ? '/api'
    : 'https://luckyball.in/api';

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
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
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
  async get(endpoint: string) {
    const res = await fetchWithTimeout(buildUrl(endpoint));
    return handleResponse(res);
  },

  async post(endpoint: string, data: any) {
    const res = await fetchWithTimeout(buildUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
};
