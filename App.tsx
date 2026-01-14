import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { User, Bet, Draw, Transaction, GameType } from './types.ts';
import { ICONS, ENTRY_FEE } from './constants.tsx';
import Home from './pages/Home.tsx';
import Betting from './pages/Betting.tsx';
import History from './pages/History.tsx';
import Wallet from './pages/Wallet.tsx';
import Admin from './pages/Admin.tsx';
import Profile from './pages/Profile.tsx';
import Login from './pages/Login.tsx';
import { api } from './api.ts';
import { Logo } from './Logo.tsx';

const AppContent: React.FC<{
  authType: 'user' | 'admin';
  currentUser: User | null;
  onUpdateUser: (user: User) => void;
  onSwitchRole: (role: 'user' | 'admin') => void;
  onLogout: () => void;
  isLoggingOut: React.MutableRefObject<boolean>;
}> = ({ authType, currentUser, onUpdateUser, onSwitchRole, onLogout, isLoggingOut }) => {
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
    if (!currentUser || isLoggingOut.current) return;
    setLoading(true);
    try {
      if (authType === 'admin') {
        const [allUsers, allBets, allDraws, allTxs, allDeposits, allWithdrawals] = await Promise.all([
          api.get('/admin/users').catch(() => []),
          api.get('/admin/bets').catch(() => []),
          api.get('/admin/draws/all').catch(() => []),
          api.get('/admin/transactions').catch(() => []),
          api.get('/admin/deposits').catch(() => []),
          api.get('/admin/withdrawals').catch(() => [])
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
          api.get(`/bets/user/${currentUser.id}`).catch(() => []),
          api.get('/draws/active').catch(() => undefined),
          api.get('/draws/recent').catch(() => []),
          api.get(`/transactions/${currentUser.id}`).catch(() => []),
          api.get(`/users/${currentUser.id}`).catch(() => null)
        ]);
        if (isLoggingOut.current) return;
        setBets(userBets);
        setActiveDraw(active);
        setDraws(recentDraws);
        setTransactions(userTxs);
        if (userData) onUpdateUser(userData);
      }
    } catch (e) { 
      console.warn("Fetch failed", e); 
    } finally { 
      if (!isLoggingOut.current) setLoading(false); 
    }
  }, [currentUser, authType, isLoggingOut, onUpdateUser]);

  useEffect(() => {
    if (currentUser) {
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
      await api.post(`/bets/${betId}/acknowledge`, {});
      await fetchData();
    } catch (e) { console.error(e); }
  };

  if (!currentUser) {
    return <Login onLogin={(user, type) => {
      onUpdateUser(user);
      onSwitchRole(type);
    }} />;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-slate-50 shadow-2xl relative border-x border-slate-200">
      <Header user={currentUser} authType={authType} />
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
                onApproveDeposit={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/deposits/${id}/approve`, {}); fetchData(); } }}
                onRejectDeposit={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/deposits/${id}/reject`, {}); fetchData(); } }}
                onApproveWithdrawal={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/withdrawals/${id}/approve`, {}); fetchData(); } }}
                onRejectWithdrawal={async (id) => { if(!isLoggingOut.current) { await api.post(`/admin/withdrawals/${id}/reject`, {}); fetchData(); } }}
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
  const [authType, setAuthType] = useState<'user' | 'admin'>(() => (localStorage.getItem('lb_auth_type') as any) || 'user');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lb_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const isLoggingOut = useRef(false);

  const handleUpdateUser = (userData: User) => {
    if (isLoggingOut.current) return;
    setCurrentUser(userData);
    localStorage.setItem('lb_user', JSON.stringify(userData));
  };

  const handleSwitchRole = (role: 'user' | 'admin') => {
    setAuthType(role);
    localStorage.setItem('lb_auth_type', role);
  };

  const handleLogout = () => {
    isLoggingOut.current = true;
    setCurrentUser(null);
    localStorage.removeItem('lb_user');
    localStorage.removeItem('lb_auth_type');
    window.location.reload();
  };

  return (
    <Router>
      <AppContent 
        authType={authType} 
        currentUser={currentUser} 
        onUpdateUser={handleUpdateUser}
        onSwitchRole={handleSwitchRole}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut} 
      />
    </Router>
  );
};

const Header: React.FC<{ user: User | null, authType: 'user' | 'admin' }> = ({ user, authType }) => (
  <header className="bg-gradient-to-r from-red-600 to-red-800 text-white p-3 sticky top-0 z-20 shadow-lg border-b border-red-400/20">
    <div className="flex justify-between items-center">
      <div className="flex flex-col">
        <Logo size="sm" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
        <p className="text-[9px] text-red-100 uppercase tracking-[0.2em] font-black mt-1 opacity-80">{authType === 'admin' ? 'System Administrator' : user?.name || user?.phone}</p>
      </div>
      <div className="flex items-center gap-3">
        {authType === 'user' && user && (
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-inner">
            <span className="text-sm font-black tracking-tight text-yellow-300">₹{(user.balance || 0).toLocaleString()}</span>
            <Link to="/wallet" className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] text-red-700 font-black shadow-lg shadow-black/20">+</Link>
          </div>
        )}
      </div>
    </div>
  </header>
);

const Navbar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-around items-center p-3 z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      <Link to="/" className={`flex flex-col items-center p-1 transition-all ${isActive('/') ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
        {ICONS.Home}<span className="text-[9px] mt-1 uppercase font-black">Home</span>
      </Link>
      <Link to="/history" className={`flex flex-col items-center p-1 transition-all ${isActive('/history') ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
        {ICONS.History}<span className="text-[9px] mt-1 uppercase font-black">Bets</span>
      </Link>
      <Link to="/wallet" className={`flex flex-col items-center p-1 transition-all ${isActive('/wallet') ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
        {ICONS.Wallet}<span className="text-[9px] mt-1 uppercase font-black">Wallet</span>
      </Link>
      <Link to="/profile" className={`flex flex-col items-center p-1 transition-all ${isActive('/profile') ? 'text-red-600 scale-110' : 'text-slate-400'}`}>
        {ICONS.Profile}<span className="text-[9px] mt-1 uppercase font-black">Profile</span>
      </Link>
    </nav>
  );
};

export default App;