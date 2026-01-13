
import React, { useState } from 'react';
import { Logo } from '../Logo.tsx';
import { api } from '../api.ts';
import { User } from '../types.ts';

interface LoginProps {
  onLogin: (user: User, type: 'user' | 'admin') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<'selection' | 'user' | 'admin'>('selection');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isProxyMode, setIsProxyMode] = useState(false);
  const [credentials, setCredentials] = useState({ user: '', pass: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering && view === 'user') {
        const user = await api.post('/signup', { 
          phone: credentials.user, 
          password: credentials.pass,
          name: credentials.name
        });
        onLogin(user, 'user');
      } else if (isProxyMode) {
        // Proxy login logic
        const user = await api.post('/proxy-login', { 
          phone: credentials.user, 
          masterKey: credentials.pass 
        });
        onLogin(user, user.isAdmin ? 'admin' : 'user');
      } else {
        // Standard login logic
        const user = await api.post('/login', { 
          phone: credentials.user, 
          password: credentials.pass, 
          isAdmin: view === 'admin' 
        });
        onLogin(user, view === 'admin' ? 'admin' : 'user');
      }
    } catch (err: any) {
      console.error("Login Error UI:", err);
      if (err.message.includes('401')) {
        setError('Invalid phone number or password');
      } else if (err.message.includes('403')) {
        setError('Invalid Proxy Master Key');
      } else if (err.message.includes('500') || err.message.includes('failed')) {
        setError('System connection error. Check GoDaddy DB logs.');
      } else {
        setError(err.message || 'Login failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setIsProxyMode(false);
    setError('');
    setCredentials({ ...credentials, name: '' });
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
          
          <div className="pt-8">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Standalone Pro Edition</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl relative animate-scale-in border border-slate-100 z-10">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setView('selection'); setIsRegistering(false); setIsProxyMode(false); }} className="p-3 text-slate-300 hover:text-red-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          </button>
          {!isRegistering && (
            <div className="flex items-center gap-2">
              <span className={`text-[8px] font-black uppercase tracking-widest ${isProxyMode ? 'text-red-600' : 'text-slate-300'}`}>Proxy</span>
              <button 
                onClick={() => setIsProxyMode(!isProxyMode)}
                className={`w-10 h-5 rounded-full relative transition-colors ${isProxyMode ? 'bg-red-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${isProxyMode ? 'translate-x-6' : 'translate-x-1'}`}></div>
              </button>
            </div>
          )}
        </div>
        
        <div className="text-center mb-8">
          <Logo size="md" className="mb-4 mx-auto" />
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
            {isProxyMode ? 'Proxy Gateway' : view === 'admin' ? 'System Access' : isRegistering ? 'New Player' : 'Player Login'}
          </h2>
          {isProxyMode && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">Superuser Access Enabled</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegistering && view === 'user' && (
            <div className="animate-fade-in">
              <input 
                required 
                type="text" 
                placeholder="Full Name" 
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
                value={credentials.name} 
                onChange={e => setCredentials({...credentials, name: e.target.value})} 
              />
            </div>
          )}
          
          <input 
            required 
            type="text" 
            placeholder={isProxyMode ? 'Any User Phone' : view === 'admin' ? 'Admin ID' : 'Phone Number'} 
            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
            value={credentials.user} 
            onChange={e => setCredentials({...credentials, user: e.target.value})} 
          />
          
          <input 
            required 
            type="password" 
            placeholder={isProxyMode ? 'Master Key' : 'Password'} 
            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-4 focus:ring-red-500/10 transition-all" 
            value={credentials.pass} 
            onChange={e => setCredentials({...credentials, pass: e.target.value})} 
          />
          
          {error && (
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 animate-pulse">
               <p className="text-red-600 text-[10px] font-black text-center uppercase tracking-widest leading-relaxed">{error}</p>
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading} 
            className={`w-full py-5 rounded-[2rem] font-black text-white transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:grayscale ${isProxyMode || view === 'admin' ? 'bg-slate-900 shadow-slate-200' : 'bg-red-600 shadow-red-200'}`}
          >
            {loading ? 'Processing...' : isProxyMode ? 'Bypass & Enter' : isRegistering ? 'Create Account' : 'Verify & Enter'}
          </button>
        </form>

        {view === 'user' && !isProxyMode && (
          <div className="mt-8 text-center">
            <button 
              onClick={toggleMode}
              className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors"
            >
              {isRegistering ? 'Already have an account? Login' : 'Don\'t have an account? Register'}
            </button>
          </div>
        )}
      </div>
      
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-red-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default Login;
