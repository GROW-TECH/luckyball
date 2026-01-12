import { Draw, User, Transaction } from './types';

const ADMIN_API_BASE = 'https://xiadot.com/luckyball.in/api/admin';

export const adminApi = {
  async post(endpoint: string, data: any = {}): Promise<any> {
    try {
      const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      // Check if response indicates an error
      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Request failed');
      }

      return result;
    } catch (error: any) {
      console.error('Admin API POST Error:', error);
      throw new Error(error.message || 'Network error');
    }
  },

  async get(endpoint: string): Promise<any> {
    try {
      const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      // Check if response indicates an error
      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Request failed');
      }

      return result;
    } catch (error: any) {
      console.error('Admin API GET Error:', error);
      throw new Error(error.message || 'Network error');
    }
  },

  // ============= ADMIN DRAW ENDPOINTS =============
  async createDraw(cycle: 1 | 2): Promise<Draw> {
    const now = Date.now();
    const cycleMinutes = cycle === 1 ? 2 : 5;
    const endTime = now + (cycleMinutes * 60 * 1000);
    
    const result = await this.post('/admin_create_draw.php', {
      cycle: cycle,
      start_time: Math.floor(now / 1000),
      end_time: Math.floor(endTime / 1000)
    });

    // Normalize the response
    return {
      id: result.data.id,
      cycle: result.data.cycle,
      startTime: result.data.start_time * 1000, // Convert back to milliseconds
      endTime: result.data.end_time * 1000,
      isCompleted: result.data.is_completed === 1,
      winningNumbers: []
    };
  },

  async finalizeDraw(drawId: string, winningNumbers: number[]): Promise<any> {
    return await this.post('/admin_finalize_draw.php', {
      draw_id: drawId,
      winning_numbers: winningNumbers
    });
  },

  async getAllDraws(): Promise<Draw[]> {
    const result = await this.get('/admin_get_draws.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((draw: any) => ({
      id: draw.id,
      cycle: draw.cycle,
      startTime: draw.start_time * 1000,
      endTime: draw.end_time * 1000,
      isCompleted: draw.is_completed === 1,
      winningNumbers: draw.winning_numbers ? JSON.parse(draw.winning_numbers) : []
    }));
  },

  // ============= ADMIN USER ENDPOINTS =============
  async getAllUsers(): Promise<User[]> {
    const result = await this.get('/admin_get_users.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((user: any) => ({
      id: user.id,
      phone: user.phone,
      name: user.name,
      balance: parseFloat(user.balance) || 0,
      isAdmin: user.is_admin === 1,
      password: '',
      upiId: user.upi_id || ''
    }));
  },

  async adjustUserBalance(userId: string, amount: number): Promise<any> {
    return await this.post('/admin_adjust_balance.php', {
      user_id: userId,
      amount: amount
    });
  },

  // ============= ADMIN TRANSACTION ENDPOINTS =============
  async getPendingDeposits(): Promise<Transaction[]> {
    const result = await this.get('/admin_get_deposits.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((tx: any) => ({
      id: tx.id,
      userId: tx.user_id,
      amount: parseFloat(tx.amount) || 0,
      type: 'deposit',
      description: tx.description || 'Deposit request',
      status: tx.status,
      timestamp: tx.timestamp * 1000,
      utr: tx.utr || ''
    }));
  },

  async getPendingWithdrawals(): Promise<Transaction[]> {
    const result = await this.get('/admin_get_withdrawals.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((tx: any) => ({
      id: tx.id,
      userId: tx.user_id,
      amount: parseFloat(tx.amount) || 0,
      type: 'withdrawal',
      description: tx.description || 'Withdrawal request',
      status: tx.status,
      timestamp: tx.timestamp * 1000,
      upiId: tx.upi_id || ''
    }));
  },

  async approveDeposit(transactionId: string): Promise<any> {
    return await this.post('/admin_approve_deposit.php', {
      transaction_id: transactionId
    });
  },

  async rejectDeposit(transactionId: string): Promise<any> {
    return await this.post('/admin_reject_deposit.php', {
      transaction_id: transactionId
    });
  },

  async approveWithdrawal(transactionId: string): Promise<any> {
    return await this.post('/admin_approve_withdrawal.php', {
      transaction_id: transactionId
    });
  },

  async rejectWithdrawal(transactionId: string): Promise<any> {
    return await this.post('/admin_reject_withdrawal.php', {
      transaction_id: transactionId
    });
  },

  async getAllTransactions(): Promise<Transaction[]> {
    const result = await this.get('/admin_get_transactions.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((tx: any) => ({
      id: tx.id,
      userId: tx.user_id,
      amount: parseFloat(tx.amount) || 0,
      type: tx.type,
      description: tx.description || '',
      status: tx.status,
      timestamp: tx.timestamp * 1000,
      utr: tx.utr || '',
      upiId: tx.upi_id || ''
    }));
  },

  async getAllBets(): Promise<any[]> {
    const result = await this.get('/admin_get_bets.php');
    if (!Array.isArray(result.data)) return [];
    
    return result.data.map((bet: any) => ({
      id: bet.id,
      userId: bet.user_id,
      drawId: bet.draw_id,
      numbers: JSON.parse(bet.numbers || '[]'),
      amount: parseFloat(bet.amount) || 0,
      potentialWin: parseFloat(bet.potential_win) || 0,
      timestamp: bet.timestamp * 1000,
      status: bet.status || 'pending'
    }));
  }
};