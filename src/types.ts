export enum GameType {
  BALL_1 = '1-Ball Match',
  BALL_2 = '2-Ball Sequence',
  BALL_3 = '3-Ball Sequence',
  BALL_5 = '5-Ball Sequence'
}

export enum BetStatus {
  PENDING = 'Pending',
  WIN = 'Win',
  LOSE = 'Lose'
}

export enum TransactionStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export interface DepositRequest {
  id: string;
  userId: string;
  amount: number;
  utr: string;
  status: TransactionStatus;
  timestamp: number;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amount: number;
  upiId: string;
  status: TransactionStatus;
  timestamp: number;
}

// types.ts
export interface Pool {
  id: string;
  gameType: GameType;
  poolSize: number;
  filled: number;
  prize: number;
}

export interface Bet {
  id: string;
  userId: string;
  gameType: GameType;
  numbers: number[];
  amount: number;
  potentialWin: number;
  timestamp: number;
  drawId: string;
  gameId: string;
  status: BetStatus;
  celebrated?: boolean;
}

export interface Draw {
  id: string;
  cycle: 1 | 2;
  startTime: number;
  endTime: number;
  resultTime: number;
  winningNumbers?: number[];
  luckyNumber?: number;
  isCompleted: boolean;
}

export interface Game {
  id: string;
  drawId: string;
  poolName: string;
  gameType: GameType | string;
  entryFee: number;
  prize: number;
  createdAt: number;
  winningNumbers?: number[];
   isCompleted: boolean;
   resultStatus :boolean;
  resultTime?: number;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  balance: number;
  isAdmin: boolean;
  upiId?: string;
  password?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win';
  timestamp: number;
  description: string;
  status?: TransactionStatus;
  utr?: string;
  upiId?: string;
}
