import React, { useState } from 'react';
import { User, Phone, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { User as UserType } from '../types';

interface LoginProps {
  onLogin: (user: UserType, type: 'user' | 'admin') => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<'selection' | 'user' | 'admin'>('selection');
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState({ 
    phone: '', 
    password: '', 
    name: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering && view === 'user') {
        // User Registration
        if (!credentials.name.trim()) {
          throw new Error('Please enter your name');
        }
        const user = await api.signup(
          credentials.phone,
          credentials.password,
          credentials.name
        );
        onLogin(user, 'user');
      } else {
        // Login (User or Admin)
        const user = await api.login(
          credentials.phone,
          credentials.password,
          view === 'admin'
        );
        onLogin(user, view === 'admin' ? 'admin' : 'user');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setCredentials({ ...credentials, name: '' });
  };

  const goBack = () => {
    setView('selection');
    setIsRegistering(false);
    setError('');
    setCredentials({ phone: '', password: '', name: '' });
  };

  // ============= SELECTION VIEW =============
  if (view === 'selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex gap-1">
                {['L', 'U', 'C', 'K', 'Y', '🎱'].map((char, i) => {
                  const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-600'];
                  return (
                    <div
                      key={i}
                      className={`w-12 h-12 ${colors[i]} rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg`}
                    >
                      {char}
                    </div>
                  );
                })}
              </div>
            </div>
            <h1 className="text-5xl font-black text-white mb-2">LUCKY BALL</h1>
            <p className="text-slate-300 text-lg">Premium Number Draw</p>
          </div>

          {/* Selection Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => setView('user')}
              className="w-full py-6 bg-white border rounded-[2.5rem] font-black text-slate-700 shadow-lg flex items-center justify-center gap-4 transition-all active:scale-95 border-slate-100 hover:shadow-xl"
            >
              <User size={28} />
              <span className="text-xl">Player Access</span>
            </button>

            <button
              onClick={() => setView('admin')}
              className="w-full py-6 bg-slate-900 rounded-[2.5rem] font-black text-white shadow-xl flex items-center justify-center gap-4 transition-all active:scale-95 hover:bg-slate-800"
            >
              <Lock size={28} />
              <span className="text-xl">Admin Portal</span>
            </button>
          </div>

          <div className="text-center mt-8 text-slate-400 text-sm">
            <p>Standalone Pro Edition</p>
          </div>
        </div>
      </div>
    );
  }

  // ============= LOGIN/REGISTER VIEW =============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={goBack}
          className="mb-6 p-3 text-slate-400 hover:text-red-600 transition-colors flex items-center gap-2 font-bold"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex gap-1">
              {['L', 'U', 'C', 'K', 'Y', '🎱'].map((char, i) => {
                const colors = ['bg-red-500', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-600'];
                return (
                  <div
                    key={i}
                    className={`w-10 h-10 ${colors[i]} rounded-full flex items-center justify-center text-white font-black shadow-lg`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>
          </div>

          <h1 className="text-3xl font-black text-white mb-2">
            {view === 'admin' ? 'SYSTEM ACCESS' : isRegistering ? 'NEW PLAYER' : 'PLAYER LOGIN'}
          </h1>

          {view === 'user' && (
            <p className="text-slate-300">
              {isRegistering ? 'Get ₹1000 Starter Bonus' : 'Welcome Back'}
            </p>
          )}
        </div>

        {/* Login/Register Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field (only for user registration) */}
            {isRegistering && view === 'user' && (
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    value={credentials.name}
                    onChange={(e) => setCredentials({ ...credentials, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/90 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-semibold"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>
            )}

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                {view === 'admin' ? 'Admin ID (999)' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  value={credentials.phone}
                  onChange={(e) => setCredentials({ ...credentials, phone: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/90 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-semibold"
                  placeholder={view === 'admin' ? 'Enter admin ID' : 'Enter phone number'}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/90 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500 font-semibold"
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-2xl flex items-center gap-2">
                <AlertCircle size={20} />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                view === 'admin'
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
              }`}
            >
              {loading ? 'Processing...' : isRegistering ? 'Create Account' : 'Verify & Enter'}
            </button>
          </form>

          {/* Toggle Login/Register (only for user view) */}
          {view === 'user' && (
            <div className="mt-6 text-center">
              <button
                onClick={toggleMode}
                className="text-white hover:text-blue-300 font-bold transition-colors underline"
              >
                {isRegistering ? "Already have an account? Login" : "Don't have an account? Register"}
              </button>
            </div>
          )}
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Login;