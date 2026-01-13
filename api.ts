
import { User, Draw, Bet, Transaction } from './types';

// The base URL for the API. In production, this usually points to the same origin.
const BASE_URL = '/api';

/**
 * Helper to handle fetch responses and throw structured errors
 */
async function handleResponse(response: Response) {
  let data;
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    // If server returns HTML (like a 404 or GoDaddy error page), capture the text
    const text = await response.text();
    console.error('Non-JSON response received:', text);
    throw new Error(`Server returned error: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

export const api = {
  /**
   * Performs a POST request to the backend
   */
  async post(endpoint: string, data: any = {}): Promise<any> {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return handleResponse(response);
    } catch (e: any) {
      console.error(`API POST Error [${endpoint}]:`, e);
      throw e;
    }
  },

  /**
   * Performs a GET request to the backend
   */
  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return handleResponse(response);
    } catch (e: any) {
      console.error(`API GET Error [${endpoint}]:`, e);
      throw e;
    }
  }
};
