
import React, { useState } from 'react';
import { User } from '../types';

interface ProfileProps {
  user: User;
  onUpdateUser: (data: Partial<User>) => void;
  onLogout?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, onLogout }) => {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [upiId, setUpiId] = useState(user.upiId || '');
  
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' });
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateInfo = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({ name, phone, upiId });
    showMsg('success', 'Profile updated successfully!');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      showMsg('error', 'New passwords do not match.');
      return;
    }
    if (passwordForm.new.length < 4) {
      showMsg('error', 'Password must be at least 4 characters.');
      return;
    }
    onUpdateUser({ password: passwordForm.new });
    setPasswordForm({ old: '', new: '', confirm: '' });
    showMsg('success', 'Password changed successfully!');
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-red-100">
          {(name || phone).charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800">{name || 'User'}</h2>
          <p className="text-slate-400 font-medium text-sm">{phone}</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl text-sm font-bold animate-bounce ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Personal Info Section */}
      <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-4 bg-red-600 rounded-full"></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Personal Details</h3>
        </div>
        <form onSubmit={handleUpdateInfo} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
            <input 
              type="text" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-700"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">UPI ID (For Withdrawals)</label>
            <input 
              type="text" 
              placeholder="username@bank"
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-700"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all">
            Save Changes
          </button>
        </form>
      </section>

      {/* Password Section */}
      <section className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Security</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
            <input 
              type="password" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-700"
              value={passwordForm.new}
              onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
            <input 
              type="password" 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-slate-700"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
            />
          </div>
          <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg shadow-slate-100 active:scale-95 transition-all">
            Update Password
          </button>
        </form>
      </section>

      <div className="pt-4 space-y-4">
        <button 
          onClick={onLogout}
          className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout Account
        </button>
      </div>
    </div>
  );
};

export default Profile;
