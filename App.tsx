import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { adminApi } from './adminApi';

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
}

interface Draw {
  id: string;
  cycle: number;
  startTime: number;
  endTime: number;
  isCompleted: boolean;
  winningNumbers?: number[];
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

// Mock API for user features
const api = {
  get: async (endpoint: string) => {
    // Simulate API calls
    return [];
  },
  post: async (endpoint: string, data: any) => {
    // Simulate API calls
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

// Simple placeholder components
const Home: React.FC<any> = () => <div className="p-4">Home Page</div>;
const Betting: React.FC<any> = () => <div className="p-4">Betting Page</div>;
const History: React.FC<any> = () => <div className="p-4">History Page</div>;
const Wallet: React.FC<any> = () => <div className="p-4">Wallet Page</div>;
const Profile: React.FC<any> = () => <div className="p-4">Profile Page</div>;
const Login: React.FC<any> = ({ onLogin }) => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-600 to-red-800">
    <div className="bg-white p-8 rounded-3xl shadow-2xl">
      <Logo size="lg" className="mb-6 text-red-600" />
      <button 
        onClick={() => onLogin({ id: 'admin', name: 'Admin', phone: '0000000000', balance: 0, isAdmin: true }, 'admin')}
        className="w-full bg-red-600 text-white py-3 rounded-xl font-bold"
      >
        Login as Admin
      </button>
    </div>
  </div>
);

// Import the actual Admin component
const Admin = React.lazy(() => import('./pages/Admin.tsx'));

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
    } catch (e) {
      console.error("Admin fetch failed:", e);
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
        if (userData) onUpdateUser(userData);
      } catch (e) { 
        console.error("Fetch failed", e); 
      } finally { 
        if (!isLoggingOut.current) setLoading(false); 
      }
    }
  }, [currentUser, authType, isLoggingOut, onUpdateUser]);

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

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative border-x border-slate-200">
      <Header user={currentUser} authType={authType} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto pb-24 custom-scrollbar relative">
        {loading && !isLoggingOut.current && (
          <div className="absolute inset-x-0 top-0 h-1 bg-red-600 animate-pulse z-[60]"></div>
        )}
        <React.Suspense fallback={<div className="p-4">Loading...</div>}>
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

const Header: React.FC<{ user: User | null, authType: string, onLogout: () => void }> = ({ user, authType, onLogout }) => (
  <header className="bg-gradient-to-r from-red-600 to-red-800 text-white p-3 sticky top-0 z-20 shadow-lg border-b border-red-400/20">
    <div className="flex justify-between items-center">
      <div className="flex flex-col">
        <Logo size="sm" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
        <p className="text-[9px] text-red-100 uppercase tracking-[0.2em] font-black mt-1 opacity-80">
          {authType === 'admin' ? 'System Administrator' : user?.name || user?.phone}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {authType === 'user' && user && (
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-inner">
            <span className="text-sm font-black tracking-tight text-yellow-300">₹{user.balance.toLocaleString()}</span>
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