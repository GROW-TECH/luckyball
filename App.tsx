
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { User, Bet, Draw, Transaction, GameType, DepositRequest, WithdrawalRequest } from './types.ts';
import { ICONS, ENTRY_FEE } from './constants.tsx';
import Home from './pages/Home.tsx';
import Betting from './pages/Betting.tsx';
import History from './pages/History.tsx';
import Wallet from './pages/Wallet.tsx';
import Admin from './pages/Admin.tsx';
import Login from './pages/Login.tsx';
import Profile from './pages/Profile.tsx';
import { api } from './api.ts';
import { Logo } from './Logo.tsx';

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
  const [adminDeposits, setAdminDeposits] = useState<any[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!currentUser || isLoggingOut.current || authType === 'none') return;
    setLoading(true);
    try {
      if (authType === 'admin') {
        const [allUsers, allBets, allDraws, allTxs, allDeposits, allWithdrawals] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/bets'),
          api.get('/admin/draws/all'),
          api.get('/admin/transactions'),
          api.get('/admin/deposits'),
          api.get('/admin/withdrawals')
        ]);
        if (isLoggingOut.current) return;
        setAdminUsers(allUsers);
        setAdminBets(allBets);
        setDraws(allDraws);
        setAdminTransactions(allTxs);
        setAdminDeposits(allDeposits);
        setAdminWithdrawals(allWithdrawals);
      } else {
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
      }
    } catch (e) { console.error("Fetch failed", e); }
    finally { if (!isLoggingOut.current) setLoading(false); }
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
    } catch (e: any) { alert(e.message || "Failed to place bet"); return false; }
  };

  const acknowledgeWin = async (betId: string) => {
    if (isLoggingOut.current) return;
    try {
      await api.post(`/bets/${betId}/acknowledge`);
      await fetchData();
    } catch (e) { console.error(e); }
  };

  if (authType === 'none') return <Login onLogin={onLogin} />;

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative border-x border-slate-200">
      <Header user={currentUser} authType={authType} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto pb-24 custom-scrollbar relative">
        {loading && !isLoggingOut.current && (
          <div className="absolute inset-x-0 top-0 h-1 bg-red-600 animate-pulse z-[60]"></div>
        )}
        <Routes>
          {authType === 'user' ? (
            <>
              <Route path="/" element={<Home activeDraw={activeDraw} draws={draws} bets={bets} onAcknowledgeWin={acknowledgeWin} />} />
              <Route path="/betting/:type" element={<Betting activeDraw={activeDraw} onPlaceBet={placeBet} />} />
              <Route path="/history" element={<History bets={bets} draws={draws} />} />
              <Route path="/wallet" element={<Wallet user={currentUser!} transactions={transactions} 
                onDepositRequest={async (amt, utr) => { if(!isLoggingOut.current) { await api.post('/deposits', { userId: currentUser!.id, amount: amt, utr }); fetchData(); } }} 
                onWithdrawRequest={async (amt, upiId) => { if(!isLoggingOut.current) { await api.post('/withdrawals', { userId: currentUser!.id, amount: amt, upiId }); fetchData(); return true; } return false; }} 
              />} />
              <Route path="/profile" element={<Profile user={currentUser!} onLogout={onLogout} 
                onUpdateUser={async (data) => { 
                  if(!isLoggingOut.current) { 
                    try {
                      const updated = await api.post(`/users/${currentUser!.id}/update`, data);
                      onUpdateUser(updated);
                    } catch (e: any) { alert(e.message || "Update failed"); }
                  } 
                }} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/admin" element={<Admin 
                draws={draws} users={adminUsers} bets={adminBets} transactions={adminTransactions} 
                depositRequests={adminDeposits} withdrawalRequests={adminWithdrawals} onLogout={onLogout}
                onCreateDraw={async (cycle) => { if(!isLoggingOut.current) { await api.post('/admin/draws', { cycle }); fetchData(); } }}
                onFinalizeDraw={async (id, win) => { if(!isLoggingOut.current) { await api.post('/admin/draws/finalize', { drawId: id, winningNumbers: win }); fetchData(); } }}
                onUpdateUserBalance={async (uid, amt) => { if(!isLoggingOut.current) { await api.post(`/admin/users/${uid}/balance`, { amount: amt }); fetchData(); } }}
                onApproveDeposit={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/deposits/${id}/approve`); fetchData(); } }}
                onRejectDeposit={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/deposits/${id}/reject`); fetchData(); } }}
                onApproveWithdrawal={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/withdrawals/${id}/approve`); fetchData(); } }}
                onRejectWithdrawal={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/withdrawals/${id}/reject`); fetchData(); } }}
              />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          )}
        </Routes>
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
        <p className="text-[9px] text-red-100 uppercase tracking-[0.2em] font-black mt-1 opacity-80">{authType === 'admin' ? 'System Administrator' : user?.name || user?.phone}</p>
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
