
import React, { useState, useEffect } from 'react';
import { Logo } from '../Logo.tsx';
import { api } from '../api.ts';
import { User } from '../../types.ts';

interface LoginProps {
  onLogin: (user: User, type: 'user' | 'admin') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<'selection' | 'user' | 'admin'>('selection');
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState({ user: '', pass: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForceReset, setShowForceReset] = useState(false);

  useEffect(() => {
    let timer: any;
    if (loading) {
      // If loading takes more than 8 seconds, show a reset button
      timer = setTimeout(() => setShowForceReset(true), 8000);
    } else {
      setShowForceReset(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowForceReset(false);

    try {
      console.log(`[Login] Attempting ${view} login for:`, credentials.user);
      
      let user: User;
      if (isRegistering && view === 'user') {
        user = await api.post('/signup', { 
          phone: credentials.user, 
          password: credentials.pass,
          name: credentials.name
        });
      } else {
        user = await api.post('/login', { 
          phone: credentials.user, 
          password: credentials.pass, 
          isAdmin: view === 'admin' 
        });
      }

      console.log("[Login] Success! User Name:", user.name);
      onLogin(user, view === 'admin' ? 'admin' : 'user');
    } catch (err: any) {
      console.error("[Login] Caught Error:", err.message);
      setError(err.message || 'Login failed. Check server status.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setLoading(false);
    setError('Request was reset manually.');
    setShowForceReset(false);
  };

  if (view === 'selection') {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-6 bg-slate-50 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-red-400/10 rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-yellow-400/10 rounded-full blur-[100px] animate-pulse-slow delay-700"></div>
        </div>

        <div className="w-full max-sm:px-4 space-y-16 text-center relative z-10 animate-fade-in">
          <div className="flex flex-col items-center space-y-6">
            <Logo size="lg" className="animate-float" />
            <p className="text-slate-500 font-black text-[12px] uppercase tracking-[0.3em]">Premium Number Draw</p>
          </div>

          <div className="space-y-6 animate-fade-up max-w-sm mx-auto w-full">
            <button onClick={() => setView('user')} className="w-full py-6 bg-white border rounded-[2.5rem] font-black text-slate-700 shadow-lg flex items-center justify-center gap-4 transition-all active:scale-95 border-slate-100">
              <span>Player Access</span>
            </button>
            <button onClick={() => setView('admin')} className="w-full py-6 bg-slate-900 rounded-[2.5rem] font-black text-white shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95">
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl relative animate-scale-in border border-slate-100 z-10">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setView('selection'); setIsRegistering(false); setError(''); }} className="p-3 text-slate-300 hover:text-red-600 transition-colors" disabled={loading}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
        </div>
        
        <div className="text-center mb-8">
          <Logo size="md" className="mb-4 mx-auto" />
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
            {view === 'admin' ? 'System Access' : isRegistering ? 'New Player' : 'Player Login'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && (
            <input 
              required 
              disabled={loading}
              type="text" 
              placeholder="Full Name" 
              className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
              value={credentials.name} 
              onChange={e => setCredentials({...credentials, name: e.target.value})} 
            />
          )}
          
          <input 
            required 
            disabled={loading}
            type="text" 
            placeholder="Username" 
            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
            value={credentials.user} 
            onChange={e => setCredentials({...credentials, user: e.target.value})} 
          />
          
          <input 
            required 
            disabled={loading}
            type="password" 
            placeholder="Password" 
            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
            value={credentials.pass} 
            onChange={e => setCredentials({...credentials, pass: e.target.value})} 
          />
          
          {error && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-pulse text-red-600 text-[10px] font-black text-center uppercase tracking-widest leading-relaxed">
               {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading} 
            className={`w-full py-5 rounded-[2rem] font-black text-white transition-all shadow-xl active:scale-95 disabled:bg-slate-300 ${view === 'admin' ? 'bg-slate-900' : 'bg-red-600'}`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Processing...
              </div>
            ) : 'Verify & Enter'}
          </button>
        </form>

        {showForceReset && (
          <button 
            onClick={resetForm}
            className="mt-4 w-full text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
          >
            Taking too long? Click to reset
          </button>
        )}

        {view === 'user' && (
          <div className="mt-8 text-center">
            <button 
              disabled={loading}
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors"
            >
              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
