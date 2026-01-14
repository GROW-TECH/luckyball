
import { User, Draw, Bet, Transaction } from './types';

const BASE_URL = '/api';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (e: any) {
    clearTimeout(id);
    if (e.name === 'AbortError') {
      throw new Error('Server took too long to respond. Connection timeout.');
    }
    throw e;
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      // Return the specific error message from server.js
      throw new Error(data.error || `Server Error (${response.status})`);
    }
    return data;
  } else {
    const text = await response.text();
    console.error('[API ERROR] Received HTML/Text instead of JSON:', text.slice(0, 100));
    
    if (response.status === 500) {
      throw new Error('Internal Server Error (500). Check server logs.');
    }
    if (response.status === 404) {
      throw new Error('API Endpoint not found (404). Check .htaccess or server routes.');
    }
    throw new Error('The server returned an invalid response format.');
  }
}

const getUrl = (endpoint: string) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${BASE_URL}/${cleanEndpoint}`;
};

export const api = {
  async get(endpoint: string) {
    try {
      const response = await fetchWithTimeout(getUrl(endpoint));
      return await handleResponse(response);
    } catch (e: any) {
      console.error('[GET Error]', e.message);
      throw e;
    }
  },
  async post(endpoint: string, data: any) {
    try {
      const response = await fetchWithTimeout(getUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await handleResponse(response);
    } catch (e: any) {
      console.error('[POST Error]', e.message);
      throw e;
    }
  }
};
