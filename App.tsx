import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { adminApi } from './adminApi';
import Login from './pages/Login';

// Types
interface User {
  id: string;
  name: string;
  phone: string;
  balance: number;
  isAdmin?: boolean;
}

interface Bet {
  id: string;
  userId: string;
  drawId: string;
  numbers: number[];
  amount: number;
  timestamp: number;
  status?: string;
  celebrated?: boolean;
  potentialWin?: number;
}

interface Draw {
  id: string;
  cycle: number;
  startTime: number;
  endTime: number;
  isCompleted: boolean;
  winningNumbers?: number[];
  resultTime?: number;
}

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  timestamp: number;
  status?: string;
  utr?: string;
  upiId?: string;
  type?: string;
}

const BetStatus = {
  PENDING: 'pending',
  WIN: 'win',
  LOSE: 'lose'
};

const GameType = {
  BALL_5_DRAW: '5-ball-draw'
};

const ENTRY_FEE = 10;

// Mock API for user features
const api = {
  get: async (endpoint: string) => {
    if (endpoint.includes('/bets/user/')) return [];
    if (endpoint.includes('/draws/active')) return null;
    if (endpoint.includes('/draws/recent')) return [];
    if (endpoint.includes('/transactions/')) return [];
    if (endpoint.includes('/users/')) return null;
    return [];
  },
  post: async (endpoint: string, data: any) => {
    return { success: true };
  }
};

const ICONS = {
  Home: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  History: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  Wallet: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  Profile: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
};

const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'h-6', md: 'h-8', lg: 'h-12' };
  return <div className={`${sizes[size]} font-black text-white ${className}`}>LUCKY BALL</div>;
};

// Confetti Component
const Confetti: React.FC = () => {
  const pieces = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: ['#facc15', '#ef4444', '#10b981', '#3b82f6', '#ffffff'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      size: 5 + Math.random() * 10,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-[-20px] rounded-sm animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }
      `}</style>
    </div>
  );
};

// Home Component
const Home: React.FC<{
  activeDraw?: Draw;
  draws: Draw[];
  bets: Bet[];
  onAcknowledgeWin: (betId: string) => void;
}> = ({ activeDraw, draws = [], bets = [], onAcknowledgeWin }) => {
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [winningBet, setWinningBet] = useState<Bet | null>(null);
  const [statusText, setStatusText] = useState('BETTING CLOSES IN');
  
  const dismissedWinIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const updateTimer = () => {
      if (!activeDraw) {
        setStatusText('AWAITING NEXT CYCLE');
        setTimeLeft('--:--:--');
        return;
      }

      const now = Date.now();
      const bettingClosed = now >= activeDraw.endTime;
      const resultTime = activeDraw.resultTime || activeDraw.endTime + 3600000;
      const resultTimeReached = now >= resultTime;

      if (resultTimeReached) {
        setStatusText('PUBLISHING RESULTS');
        setTimeLeft('PLEASE WAIT...');
      } else if (bettingClosed) {
        setStatusText('BETTING CLOSED');
        setTimeLeft(`RESULT AT ${new Date(resultTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      } else {
        setStatusText('BETTING CLOSES IN');
        const diff = activeDraw.endTime - now;
        if (diff <= 0) {
          setTimeLeft('00:00:00');
        } else {
          const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
          const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
          const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
          setTimeLeft(`${hours}:${mins}:${secs}`);
        }
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeDraw]);

  useEffect(() => {
    if (!bets || bets.length === 0) return;

    const uncelebratedWin = bets.find(b => 
      b.status === BetStatus.WIN && 
      !b.celebrated && 
      !dismissedWinIds.current.has(b.id)
    );
    
    if (uncelebratedWin && !winningBet) {
      setWinningBet(uncelebratedWin);
    }
  }, [bets, winningBet]);

  const handleCloseWinModal = () => {
    if (winningBet) {
      dismissedWinIds.current.add(winningBet.id);
      onAcknowledgeWin(winningBet.id);
      setWinningBet(null);
    }
  };

  const isBettingClosed = activeDraw ? Date.now() >= activeDraw.endTime : true;
  const recentDraws = draws.filter(d => d.isCompleted).slice(0, 3);

  const getTimeFontSize = () => {
    if (timeLeft.length > 8) return 'text-2xl mt-4 px-4';
    return 'text-6xl';
  };

  return (
    <div className="p-4 space-y-8 relative">
      {winningBet && <Confetti />}

      <div className="bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-[0_20px_40px_-15px_rgba(202,138,4,0.4)] relative overflow-hidden border-4 border-yellow-200/30">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-4 shadow-xl border ${isBettingClosed ? 'bg-slate-800 border-slate-600' : 'bg-red-600 border-red-400'}`}>
            {statusText}
          </div>
          <p className="text-yellow-100 text-xs font-black uppercase tracking-widest mb-1 drop-shadow-md">
            {activeDraw ? `Draw Cycle ${activeDraw.cycle}` : 'Waiting for Admin'}
          </p>
          <div className={`font-black font-mono tracking-tighter drop-shadow-2xl text-white ${getTimeFontSize()}`}>
            {timeLeft}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
            <svg className="w-4 h-4 text-yellow-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Results Published Daily at 09:00 PM</span>
          </div>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="font-black text-slate-800 text-xl tracking-tight">Active Jackpot</h3>
          <button onClick={() => setShowHowToPlay(true)} className="text-[10px] bg-white border border-slate-200 px-4 py-2 rounded-full font-black text-red-600 uppercase tracking-widest shadow-sm hover:bg-red-50 transition-all">RULES</button>
        </div>
        
        <Link 
          to={(!isBettingClosed && activeDraw) ? `/betting/${encodeURIComponent(GameType.BALL_5_DRAW)}` : '#'}
          className={`block group bg-white rounded-[3rem] p-8 border-2 border-transparent hover:border-red-500 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_30px_60px_-15px_rgba(239,68,68,0.2)] transition-all duration-500 relative overflow-hidden ${isBettingClosed ? 'opacity-70 grayscale-0 cursor-not-allowed' : ''}`}
          onClick={(e) => { if (isBettingClosed) e.preventDefault(); }}
        >
          <div className="absolute top-0 right-0 p-4">
             <span className={`font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full border ${isBettingClosed ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {isBettingClosed ? 'BETTING CLOSED' : `ENTRY: ₹${ENTRY_FEE}`}
             </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br flex items-center justify-center mb-6 shadow-2xl transition-transform ${isBettingClosed ? 'from-slate-400 to-slate-600' : 'from-red-500 to-red-800 group-hover:scale-110'}`}>
               <div className="flex -space-x-2">
                 {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 font-black text-xs border border-slate-100">?</div>)}
               </div>
            </div>
            <h4 className="font-black text-slate-800 tracking-tight text-2xl group-hover:text-red-600 transition-colors">5-Ball Sequence</h4>
            <p className="text-[11px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Match in order & Win up to</p>
            <p className="text-4xl font-black text-emerald-600 tracking-tighter mt-1">₹5,00,000</p>
            
            <div className={`mt-8 w-full py-5 rounded-2xl text-white text-xs font-black uppercase tracking-[0.3em] transition-colors shadow-lg ${isBettingClosed ? 'bg-slate-300' : 'bg-slate-900 group-hover:bg-red-600'}`}>
              {isBettingClosed ? 'Closed for Result' : 'Enter Draw Now'}
            </div>
          </div>
        </Link>
      </section>

      {recentDraws.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Recent Results</h3>
          </div>
          <div className="space-y-5">
            {recentDraws.map(draw => {
              const resultTime = draw.resultTime || draw.endTime;
              return (
                <div key={draw.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {new Date(resultTime).toLocaleDateString(undefined, {month:'short', day:'numeric'})} Draw
                    </span>
                    <span className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase">Verified</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    {draw.winningNumbers && draw.winningNumbers.length > 0 ? (
                      draw.winningNumbers.map((n, i) => (
                        <div key={i} className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center font-black text-slate-700 shadow-sm relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent"></div>
                          {n}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Results pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {winningBet && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleCloseWinModal}></div>
          <div className="relative w-full max-w-[340px] bg-gradient-to-b from-yellow-300 to-orange-600 rounded-[3rem] p-8 shadow-[0_0_100px_rgba(250,204,21,0.5)] border-4 border-yellow-200 animate-winner-pop text-center">
             <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <div className="w-32 h-32 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-trophy-bounce">
                  <svg className="w-16 h-16 text-orange-700" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05l-3.294 2.744.888 3.554a1 1 0 01-1.481 1.061L10 16.338l-3.02 1.51a1 1 0 01-1.481-1.06l.888-3.555-3.294-2.744a1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z"/></svg>
                </div>
             </div>
             <div className="mt-16 space-y-4">
                <h2 className="text-white font-black text-4xl tracking-tighter uppercase leading-none drop-shadow-lg">JACKPOT WINNER!</h2>
                <div className="bg-white/20 backdrop-blur-md py-4 rounded-3xl border border-white/20">
                   <p className="text-yellow-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Prize Credited</p>
                   <p className="text-white text-5xl font-black tracking-tighter">₹{(winningBet.potentialWin || 0).toLocaleString()}</p>
                </div>
                <button onClick={handleCloseWinModal} className="w-full py-5 bg-white text-orange-600 rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] text-sm mt-4 border-2 border-orange-100">Collect Prize</button>
             </div>
          </div>
        </div>
      )}

      {showHowToPlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHowToPlay(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar border-4 border-red-50">
            <button onClick={() => setShowHowToPlay(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-red-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            <div className="text-center mb-10"><h2 className="text-3xl font-black text-slate-800 tracking-tight">Jackpot Rules</h2><p className="text-red-500 font-black text-[10px] uppercase tracking-widest mt-2">Sequential Match Bonus</p></div>
            <div className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                 <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Daily Schedule</p>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Betting Starts</span><span className="text-emerald-600 font-black">Morning</span></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Betting Closes</span><span className="text-red-600 font-black">08:00 PM</span></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Results Published</span><span className="text-orange-600 font-black">09:00 PM</span></div>
                 </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200/50">
                <p className="text-[10px] text-yellow-800 text-center font-black uppercase tracking-widest leading-relaxed">Important Logic</p>
                <p className="text-[10px] text-yellow-700 text-center mt-2 font-medium italic">Matches must be in sequence from Ball #1 onwards. One entry costs ₹{ENTRY_FEE}.</p>
              </div>
              <button onClick={() => setShowHowToPlay(false)} className="w-full py-5 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all text-sm uppercase tracking-[0.2em]">I Understand</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes winner-pop { from { opacity: 0; transform: scale(0.5) translateY(50px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-winner-pop { animation: winner-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes trophy-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-trophy-bounce { animation: trophy-bounce 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

// Placeholder components for other pages
const Betting: React.FC<any> = () => <div className="p-4">Betting Page</div>;
const History: React.FC<any> = () => <div className="p-4">History Page</div>;
const Wallet: React.FC<any> = () => <div className="p-4">Wallet Page</div>;
const Profile: React.FC<any> = () => <div className="p-4">Profile Page</div>;

// Lazy load Admin component
const Admin = React.lazy(() => import('./pages/Admin'));

const AppContent: React.FC<{
  authType: 'none' | 'user' | 'admin';
  currentUser: User | null;
  onLogin: (user: User, type: 'user' | 'admin') => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  isLoggingOut: React.MutableRefObject<boolean>;
}> = ({ authType, currentUser, onLogin, onLogout, onUpdateUser, isLoggingOut }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [activeDraw, setActiveDraw] = useState<Draw | undefined>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminBets, setAdminBets] = useState<Bet[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [adminDeposits, setAdminDeposits] = useState<Transaction[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<Transaction[]>([]);

  const fetchAdminData = async () => {
    if (isLoggingOut.current) return;
    try {
      setLoading(true);
      const [allUsers, allBets, allDraws, allTxs, allDeposits, allWithdrawals] = await Promise.all([
        adminApi.getAllUsers(),
        adminApi.getAllBets(),
        adminApi.getAllDraws(),
        adminApi.getAllTransactions(),
        adminApi.getPendingDeposits(),
        adminApi.getPendingWithdrawals()
      ]);
      
      if (isLoggingOut.current) return;
      
      setAdminUsers(allUsers);
      setAdminBets(allBets);
      setDraws(allDraws);
      setAdminTransactions(allTxs);
      setAdminDeposits(allDeposits);
      setAdminWithdrawals(allWithdrawals);
      setInitialLoadComplete(true);
    } catch (e) {
      console.error("Admin fetch failed:", e);
      setInitialLoadComplete(true);
    } finally {
      if (!isLoggingOut.current) setLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!currentUser || isLoggingOut.current || authType === 'none') return;
    
    if (authType === 'admin') {
      await fetchAdminData();
    } else {
      setLoading(true);
      try {
        const [userBets, active, recentDraws, userTxs, userData] = await Promise.all([
          api.get(`/bets/user/${currentUser.id}`),
          api.get('/draws/active'),
          api.get('/draws/recent'),
          api.get(`/transactions/${currentUser.id}`),
          api.get(`/users/${currentUser.id}`)
        ]);
        if (isLoggingOut.current) return;
        setBets(userBets);
        setActiveDraw(active);
        setDraws(recentDraws);
        setTransactions(userTxs);
        setInitialLoadComplete(true);
      } catch (e) { 
        console.error("Fetch failed", e);
        setInitialLoadComplete(true);
      } finally { 
        if (!isLoggingOut.current) setLoading(false); 
      }
    }
  }, [currentUser, authType, isLoggingOut]);

  useEffect(() => {
    if (currentUser && authType !== 'none') {
      fetchData();
      const interval = setInterval(() => {
        if (!isLoggingOut.current) fetchData();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser, authType, fetchData, isLoggingOut]);

  const placeBet = async (betData: any) => {
    if (!currentUser || isLoggingOut.current) return false;
    try {
      await api.post('/bets', { ...betData, userId: currentUser.id });
      await fetchData();
      return true;
    } catch (e: any) { 
      alert(e.message || "Failed to place bet"); 
      return false; 
    }
  };

  const acknowledgeWin = async (betId: string) => {
    if (isLoggingOut.current) return;
    try {
      await api.post(`/bets/${betId}/acknowledge`);
      await fetchData();
    } catch (e) { 
      console.error(e); 
    }
  };

  if (authType === 'none') return <Login onLogin={onLogin} />;

  if (!initialLoadComplete) {
    return (
      <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative border-x border-slate-200">
        <Header user={currentUser} authType={authType} onLogout={onLogout} isLoading={true} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative border-x border-slate-200">
      <Header user={currentUser} authType={authType} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto pb-24 custom-scrollbar relative">
        {loading && !isLoggingOut.current && (
          <div className="absolute inset-x-0 top-0 h-1 bg-red-600 animate-pulse z-[60]"></div>
        )}
        <React.Suspense fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Loading...</p>
            </div>
          </div>
        }>
          <Routes>
            {authType === 'user' ? (
              <>
                <Route path="/" element={<Home activeDraw={activeDraw} draws={draws} bets={bets} onAcknowledgeWin={acknowledgeWin} />} />
                <Route path="/betting/:type" element={<Betting activeDraw={activeDraw} onPlaceBet={placeBet} />} />
                <Route path="/history" element={<History bets={bets} draws={draws} />} />
                <Route path="/wallet" element={<Wallet user={currentUser!} transactions={transactions} 
                  onDepositRequest={async (amt: number, utr: string) => { if(!isLoggingOut.current) { await api.post('/deposits', { userId: currentUser!.id, amount: amt, utr }); fetchData(); } }} 
                  onWithdrawRequest={async (amt: number, upiId: string) => { if(!isLoggingOut.current) { await api.post('/withdrawals', { userId: currentUser!.id, amount: amt, upiId }); fetchData(); return true; } return false; }} 
                />} />
                <Route path="/profile" element={<Profile user={currentUser!} onLogout={onLogout} onUpdateUser={async (data: any) => { if(!isLoggingOut.current) { fetchData(); } }} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <>
                <Route path="/admin" element={
                  <Admin 
                    draws={draws} 
                    users={adminUsers} 
                    bets={adminBets} 
                    transactions={adminTransactions} 
                    depositRequests={adminDeposits} 
                    withdrawalRequests={adminWithdrawals} 
                    onLogout={onLogout}
                    onCreateDraw={async (cycle: 1 | 2) => { 
                      if(!isLoggingOut.current) { 
                        try {
                          await adminApi.createDraw(cycle);
                          await fetchAdminData();
                        } catch (error: any) {
                          throw new Error(error.message || 'Failed to create draw');
                        }
                      } 
                    }}
                    onFinalizeDraw={async (id: string, win: number[]) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.finalizeDraw(id, win);
                        await fetchAdminData();
                      } 
                    }}
                    onUpdateUserBalance={async (uid: string, amt: number) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.adjustUserBalance(uid, amt);
                        await fetchAdminData();
                      } 
                    }}
                    onApproveDeposit={async (id: string) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.approveDeposit(id);
                        await fetchAdminData();
                      } 
                    }}
                    onRejectDeposit={async (id: string) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.rejectDeposit(id);
                        await fetchAdminData();
                      } 
                    }}
                    onApproveWithdrawal={async (id: string) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.approveWithdrawal(id);
                        await fetchAdminData();
                      } 
                    }}
                    onRejectWithdrawal={async (id: string) => { 
                      if(!isLoggingOut.current) { 
                        await adminApi.rejectWithdrawal(id);
                        await fetchAdminData();
                      } 
                    }}
                  />
                } />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </>
            )}
          </Routes>
        </React.Suspense>
      </main>
      {authType === 'user' && !isLoggingOut.current && <Navbar />}
    </div>
  );
};

const App: React.FC = () => {
  const [authType, setAuthType] = useState<'none' | 'user' | 'admin'>(() => (localStorage.getItem('lb_auth_type') as any) || 'none');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lb_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const isLoggingOut = useRef(false);

  const handleLogin = (user: User, type: 'user' | 'admin') => {
    isLoggingOut.current = false;
    setAuthType(type);
    setCurrentUser(user);
    localStorage.setItem('lb_auth_type', type);
    localStorage.setItem('lb_user', JSON.stringify(user));
  };

  const handleUpdateUser = (userData: User) => {
    if (isLoggingOut.current) return;
    setCurrentUser(userData);
    localStorage.setItem('lb_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    isLoggingOut.current = true;
    setAuthType('none');
    setCurrentUser(null);
    localStorage.removeItem('lb_auth_type');
    localStorage.removeItem('lb_user');
    window.location.hash = '#/';
  };

  return (
    <Router>
      <AppContent 
        authType={authType} 
        currentUser={currentUser} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        onUpdateUser={handleUpdateUser}
        isLoggingOut={isLoggingOut} 
      />
    </Router>
  );
};

const Header: React.FC<{ user: User | null, authType: string, onLogout: () => void, isLoading?: boolean }> = ({ user, authType, onLogout, isLoading = false }) => (
  <header className="bg-gradient-to-r from-red-600 to-red-800 text-white p-3 sticky top-0 z-20 shadow-lg border-b border-red-400/20">
    <div className="flex justify-between items-center">
      <div className="flex flex-col">
        <Logo size="sm" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
        <p className="text-[9px] text-red-100 uppercase tracking-[0.2em] font-black mt-1 opacity-80">
          {authType === 'admin' ? 'System Administrator' : user?.name || user?.phone || 'Loading...'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {authType === 'user' && user && (
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-inner">
            <span className="text-sm font-black tracking-tight text-yellow-300">
              {isLoading ? '...' : `₹${(user.balance || 0).toLocaleString()}`}
            </span>
            <Link to="/wallet" className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] text-red-700 font-black shadow-lg shadow-black/20">+</Link>
          </div>
        )}
        <button 
          onClick={(e) => { e.preventDefault(); onLogout(); }} 
          title="Logout"
          className="p-2 bg-white/20 rounded-xl hover:bg-red-500 transition-all active:scale-90 border border-white/10 group"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
);

const Navbar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-around items-center p-3 z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      <Link to="/" className={`flex flex-col items-center p-1 rounded-xl transition-all ${isActive('/') ? 'text-red-600 scale-110 font-bold' : 'text-slate-400'}`}>
        {ICONS.Home}<span className="text-[10px] mt-1 uppercase tracking-widest font-black">Home</span>
      </Link>
      <Link to="/history" className={`flex flex-col items-center p-1 rounded-xl transition-all ${isActive('/history') ? 'text-red-600 scale-110 font-bold' : 'text-slate-400'}`}>
        {ICONS.History}<span className="text-[10px] mt-1 uppercase tracking-widest font-black">Bets</span>
      </Link>
      <Link to="/wallet" className={`flex flex-col items-center p-1 rounded-xl transition-all ${isActive('/wallet') ? 'text-red-600 scale-110 font-bold' : 'text-slate-400'}`}>
        {ICONS.Wallet}<span className="text-[10px] mt-1 uppercase tracking-widest font-black">Wallet</span>
      </Link>
      <Link to="/profile" className={`flex flex-col items-center p-1 rounded-xl transition-all ${isActive('/profile') ? 'text-red-600 scale-110 font-bold' : 'text-slate-400'}`}>
        {ICONS.Profile}<span className="text-[10px] mt-1 uppercase tracking-widest font-black">Profile</span>
      </Link>
    </nav>
  );
};

export default App;