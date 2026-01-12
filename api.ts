import { User, Draw, Bet, Transaction } from './types';

const API_BASE = 'https://xiadot.com/luckyball.in/api';

// Helper to normalize API responses (convert snake_case to camelCase)
const normalizeUser = (data: any): User => ({
  id: data.id,
  phone: data.phone,
  name: data.name,
  balance: parseFloat(data.balance) || 0,
  isAdmin: data.is_admin === 1 || data.isAdmin === true,
  password: data.password || '',
  upiId: data.upi_id || data.upiId || ''
});

const normalizeDraw = (data: any): Draw => ({
  id: data.id,
  cycle: data.cycle || 1,
  startTime: data.start_time || data.startTime || Date.now(),
  endTime: data.end_time || data.endTime || Date.now(),
  resultTime: data.result_time || data.resultTime || Date.now(),
  isCompleted: data.is_completed === 1 || data.isCompleted === true,
  winningNumbers: data.winning_numbers || data.winningNumbers || []
});

const normalizeBet = (data: any): Bet => ({
  id: data.id,
  userId: data.user_id || data.userId,
  drawId: data.draw_id || data.drawId,
  numbers: Array.isArray(data.numbers) ? data.numbers : JSON.parse(data.numbers || '[]'),
  amount: parseFloat(data.amount) || 0,
  potentialWin: parseFloat(data.potential_win || data.potentialWin) || 0,
  timestamp: data.timestamp || Date.now(),
  status: data.status || 'pending',
  celebrated: data.celebrated === 1 || data.celebrated === true,
  gameType: data.game_type || data.gameType || 'ball_5_draw'
});

const normalizeTransaction = (data: any): Transaction => ({
  id: data.id,
  userId: data.user_id || data.userId,
  amount: parseFloat(data.amount) || 0,
  type: data.type || 'deposit',
  description: data.description || '',
  status: data.status || 'pending',
  timestamp: data.timestamp || Date.now(),
  utr: data.utr || '',
  upiId: data.upi_id || data.upiId || ''
});

export const api = {
  async post(endpoint: string, data: any = {}): Promise<any> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      // Check if response indicates an error
      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Request failed');
      }

      return result;
    } catch (error: any) {
      console.error('API POST Error:', error);
      throw new Error(error.message || 'Network error');
    }
  },

  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      // Check if response indicates an error
      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Request failed');
      }

      return result;
    } catch (error: any) {
      console.error('API GET Error:', error);
      throw new Error(error.message || 'Network error');
    }
  },

  // ============= AUTH ENDPOINTS =============
  async login(phone: string, password: string, isAdmin: boolean = false): Promise<User> {
    const result = await this.post('/login.php', { phone, password, isAdmin });
    return normalizeUser(result);
  },

  async signup(phone: string, password: string, name: string): Promise<User> {
    const result = await this.post('/signup.php', { phone, password, name });
    return normalizeUser(result);
  },

  // ============= USER ENDPOINTS =============
  async getUser(userId: string | number): Promise<User> {
    const result = await this.get(`/get_user.php?id=${userId}`);
    return normalizeUser(result);
  },

  async getAllUsers(): Promise<User[]> {
    const result = await this.get('/get_users.php');
    return Array.isArray(result) ? result.map(normalizeUser) : [];
  },

  async adjustBalance(userId: string | number, amount: number): Promise<any> {
    return await this.post('/adjust_balance.php', { user_id: userId, amount });
  },

  // ============= DRAW ENDPOINTS =============
  async getActiveDraw(): Promise<Draw | null> {
    try {
      const result = await this.get('/get_active_draw.php');
      return result ? normalizeDraw(result) : null;
    } catch {
      return null;
    }
  },

  async getAllDraws(): Promise<Draw[]> {
    const result = await this.get('/get_draws.php');
    return Array.isArray(result) ? result.map(normalizeDraw) : [];
  },

  async getRecentDraws(): Promise<Draw[]> {
    const result = await this.get('/get_recent_draws.php');
    return Array.isArray(result) ? result.map(normalizeDraw) : [];
  },

  async createDraw(cycle: 1 | 2 = 1): Promise<Draw> {
    const result = await this.post('/create_draw.php', { cycle });
    return normalizeDraw(result);
  },

  async finalizeDraw(drawId: string | number, winningNumbers: number[]): Promise<any> {
    return await this.post('/finalize_draw.php', { 
      draw_id: drawId, 
      winning_numbers: winningNumbers 
    });
  },

  // ============= BET ENDPOINTS =============
  async placeBet(userId: string | number, drawId: string | number, numbers: number[], amount: number, potentialWin: number): Promise<any> {
    return await this.post('/place_bet.php', {
      user_id: userId,
      draw_id: drawId,
      numbers,
      amount,
      potential_win: potentialWin
    });
  },

  async getUserBets(userId: string | number): Promise<Bet[]> {
    const result = await this.get(`/get_user_bets.php?user_id=${userId}`);
    return Array.isArray(result) ? result.map(normalizeBet) : [];
  },

  async getAllBets(): Promise<Bet[]> {
    const result = await this.get('/get_bets.php');
    return Array.isArray(result) ? result.map(normalizeBet) : [];
  },

  async acknowledgeBet(betId: string | number): Promise<any> {
    return await this.post('/acknowledge_bet.php', { bet_id: betId });
  },

  // ============= TRANSACTION ENDPOINTS =============
  async getUserTransactions(userId: string | number): Promise<Transaction[]> {
    const result = await this.get(`/get_user_transactions.php?user_id=${userId}`);
    return Array.isArray(result) ? result.map(normalizeTransaction) : [];
  },

  async getAllTransactions(): Promise<Transaction[]> {
    const result = await this.get('/get_transactions.php');
    return Array.isArray(result) ? result.map(normalizeTransaction) : [];
  },

  async getPendingDeposits(): Promise<Transaction[]> {
    const result = await this.get('/get_deposits.php');
    return Array.isArray(result) ? result.map(normalizeTransaction) : [];
  },

  async getPendingWithdrawals(): Promise<Transaction[]> {
    const result = await this.get('/get_withdrawals.php');
    return Array.isArray(result) ? result.map(normalizeTransaction) : [];
  },

  async requestDeposit(userId: string | number, amount: number, utr: string): Promise<any> {
    return await this.post('/request_deposit.php', {
      user_id: userId,
      amount,
      utr
    });
  },

  async requestWithdrawal(userId: string | number, amount: number, upiId: string): Promise<any> {
    return await this.post('/request_withdrawal.php', {
      user_id: userId,
      amount,
      upi_id: upiId
    });
  },

  async updateDeposit(transactionId: string | number, status: 'approved' | 'rejected'): Promise<any> {
    return await this.post('/update_deposit.php', {
      id: transactionId,
      status
    });
  },

  async updateWithdrawal(transactionId: string | number, status: 'approved' | 'rejected'): Promise<any> {
    return await this.post('/update_withdrawal.php', {
      id: transactionId,
      status
    });
  }
};