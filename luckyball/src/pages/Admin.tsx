
import React, { useState } from 'react';
import { Draw, User, Transaction, TransactionStatus, Bet } from '../../types';
import { api } from '../api';

interface AdminProps {
  draws: Draw[];
  users: User[];
  bets: Bet[];
  transactions: Transaction[];
  depositRequests: Transaction[];
  withdrawalRequests: Transaction[];
  onCreateDraw: (cycle: 1 | 2) => void | Promise<void>;
  onFinalizeDraw: (drawId: string, winning: number[]) => void | Promise<void>;
  onUpdateUserBalance: (userId: string, amount: number) => void | Promise<void>;
  onApproveDeposit: (requestId: string) => void | Promise<void>;
  onRejectDeposit: (requestId: string) => void | Promise<void>;
  onApproveWithdrawal: (requestId: string) => void | Promise<void>;
  onRejectWithdrawal: (requestId: string) => void | Promise<void>;
  onLogout: () => void;
}

const Admin: React.FC<AdminProps> = ({ 
  draws, users, bets, transactions, depositRequests, withdrawalRequests,
  onCreateDraw, onFinalizeDraw, onUpdateUserBalance,
  onApproveDeposit, onRejectDeposit, onApproveWithdrawal, onRejectWithdrawal, onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'draws' | 'users' | 'requests' | 'history' | 'settings'>('draws');
  const [requestSubTab, setRequestSubTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [editingDraw, setEditingDraw] = useState<string | null>(null);
  const [viewingBets, setViewingBets] = useState<string | null>(null);
  const [winningInput, setWinningInput] = useState<string>('');
  
  const [adjustingUser, setAdjustingUser] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState<string>('');

  const handleFinalize = (drawId: string) => {
    const winningNumbers = winningInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (winningNumbers.length !== 5) {
      alert("Please enter exactly 5 winning numbers in sequence.");
      return;
    }
    onFinalizeDraw(drawId, winningNumbers);
    setEditingDraw(null);
    setWinningInput('');
  };

  const activeDraws = draws.filter(d => !d.isCompleted);
  const getBetsForDraw = (drawId: string) => bets.filter(b => b.drawId === drawId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-2 sticky top-0 z-30 shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-2">
          {[
            { id: 'draws', label: 'Draws' },
            { id: 'requests', label: `Pending (${depositRequests.length + withdrawalRequests.length})` },
            { id: 'users', label: 'Users' },
            { id: 'history', label: 'Global Tx' },
            { id: 'settings', label: 'Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] uppercase font-black tracking-widest whitespace-nowrap transition-all ${
                activeTab === tab.id 
                ? 'bg-red-600 text-white shadow-lg shadow-red-100' 
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {activeTab === 'draws' && (
          <div className="space-y-6 animate-fade-in">
            <button onClick={() => onCreateDraw(1)} className="w-full py-5 bg-white text-red-600 rounded-3xl font-black border-2 border-dashed border-red-200 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              START NEW DRAW CYCLE
            </button>

            <section>
              <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
                ACTIVE MONITORING
              </h3>
              <div className="space-y-6">
                {activeDraws.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-[2rem] border border-slate-100">
                    <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No active draws in progress</p>
                  </div>
                )}
                {activeDraws.map(draw => {
                  const drawBets = getBetsForDraw(draw.id);
                  return (
                    <div key={draw.id} className="bg-white rounded-[2.5rem] shadow-md border border-slate-100 overflow-hidden">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">LIVE DRAW: {draw.id.slice(-6)}</span>
                            <h4 className="text-xl font-black text-slate-800 tracking-tight">Cycle {draw.cycle}</h4>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Ends: {new Date(draw.endTime).toLocaleTimeString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Entries</p>
                            <p className="text-2xl font-black text-emerald-600 tracking-tighter animate-pulse">{drawBets.length}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                          <button 
                            onClick={() => setViewingBets(viewingBets === draw.id ? null : draw.id)}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${viewingBets === draw.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-100 shadow-sm'}`}
                          >
                            Analyze Entries
                          </button>
                          <button 
                            onClick={() => setEditingDraw(editingDraw === draw.id ? null : draw.id)}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${editingDraw === draw.id ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-white text-red-600 border-red-100'}`}
                          >
                            Declare Results
                          </button>
                        </div>

                        {editingDraw === draw.id && (
                          <div className="p-6 bg-red-50 rounded-[2rem] border border-red-100 space-y-4 animate-fade-in mb-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-2">Winning Sequence (5 Balls)</label>
                              <input placeholder="e.g. 1, 3, 5, 7, 9" className="w-full p-4 bg-white border-2 border-red-100 rounded-2xl outline-none focus:border-red-600 font-black text-sm transition-all" value={winningInput} onChange={e => setWinningInput(e.target.value)} />
                            </div>
                            <button onClick={() => handleFinalize(draw.id)} className="w-full bg-red-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-200 active:scale-95 transition-all">Submit Results</button>
                          </div>
                        )}

                        {viewingBets === draw.id && (
                          <div className="space-y-3 animate-fade-in border-t border-slate-100 pt-6">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detailed Entry List</h5>
                              <span className="text-[9px] font-bold text-slate-300 italic">{drawBets.length} sequences placed</span>
                            </div>
                            {drawBets.length === 0 ? (
                               <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                  <p className="text-slate-300 font-black text-[9px] uppercase tracking-widest">Awaiting first participant...</p>
                               </div>
                            ) : (
                               drawBets.map(bet => {
                                 const user = users.find(u => u.id === bet.userId);
                                 return (
                                   <div key={bet.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                      <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                                               {user?.name?.charAt(0) || '?'}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-800">{user?.name || 'Unknown'}</span>
                                            <span className="text-[9px] font-bold text-slate-400">({user?.phone})</span>
                                         </div>
                                         <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">
                                            {new Date(bet.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                         </span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                         <div className="flex gap-2">
                                           {bet.numbers.map((n, i) => (
                                              <div key={i} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-inner relative overflow-hidden group">
                                                 <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                                                 {n}
                                              </div>
                                           ))}
                                         </div>
                                         <div className="text-right">
                                            <p className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">Fee</p>
                                            <p className="text-xs font-black text-slate-800 tracking-tighter">₹{bet.amount}</p>
                                         </div>
                                      </div>
                                   </div>
                                 );
                               })
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl mb-4 border border-slate-200 shadow-inner">
              <button onClick={() => setRequestSubTab('deposits')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${requestSubTab === 'deposits' ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}>Deposits ({depositRequests.length})</button>
              <button onClick={() => setRequestSubTab('withdrawals')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${requestSubTab === 'withdrawals' ? 'bg-white text-red-600 shadow-md' : 'text-slate-400'}`}>Withdrawals ({withdrawalRequests.length})</button>
            </div>

            {requestSubTab === 'deposits' ? (
              <div className="space-y-5">
                {depositRequests.length === 0 && (
                   <div className="text-center py-12 bg-white rounded-[2rem] border border-slate-100">
                     <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No pending deposits</p>
                   </div>
                )}
                {depositRequests.map(req => {
                  const user = users.find(u => u.id === req.userId);
                  return (
                    <div key={req.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg tracking-tight">{user?.name}</h4>
                          <p className="text-[10px] text-slate-400 font-black uppercase mt-1">UTR: <span className="text-red-500 font-mono">{req.utr}</span></p>
                        </div>
                        <p className="text-2xl font-black text-emerald-600">₹{req.amount}</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => onApproveDeposit(req.id)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Approve</button>
                        <button onClick={() => onRejectDeposit(req.id)} className="flex-1 bg-white text-red-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-red-50 active:scale-95 transition-all">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-5">
                {withdrawalRequests.length === 0 && (
                   <div className="text-center py-12 bg-white rounded-[2rem] border border-slate-100">
                     <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No pending withdrawals</p>
                   </div>
                )}
                {withdrawalRequests.map(req => {
                  const user = users.find(u => u.id === req.userId);
                  return (
                    <div key={req.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg tracking-tight">{user?.name}</h4>
                          <p className="text-[10px] text-slate-400 font-black uppercase mt-1">UPI: <span className="text-red-600">{req.upiId}</span></p>
                        </div>
                        <p className="text-2xl font-black text-red-600">₹{Math.abs(req.amount)}</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => onApproveWithdrawal(req.id)} className="flex-1 bg-red-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Verify & Pay</button>
                        <button onClick={() => onRejectWithdrawal(req.id)} className="flex-1 bg-white text-red-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-red-50 active:scale-95 transition-all">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-3"><span className="w-1.5 h-6 bg-red-600 rounded-full"></span>PLAYER DATABASE ({users.length})</h3>
            <div className="space-y-4">
              {users.map(user => (
                <div key={user.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-100 ring-4 ring-white">
                        {(user.name || 'P').charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm tracking-tight">{user.name || 'Anonymous Player'}</h4>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{user.phone} • ID: {user.id.slice(-8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Balance</p>
                      <p className="text-xl font-black text-red-600 tracking-tighter">₹{user.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex gap-2">
                    {adjustingUser === user.id ? (
                      <div className="flex-1 flex gap-2 animate-scale-in">
                        <input type="number" placeholder="+/- Amount" className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black outline-none focus:border-red-600 transition-all" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} />
                        <button onClick={() => { onUpdateUserBalance(user.id, parseFloat(adjAmount)); setAdjustingUser(null); setAdjAmount(''); }} className="bg-red-600 text-white px-5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100">Apply</button>
                        <button onClick={() => setAdjustingUser(null)} className="bg-slate-200 text-slate-600 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest">X</button>
                      </div>
                    ) : (
                      <button onClick={() => setAdjustingUser(user.id)} className="w-full bg-slate-900 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">Adjust Balance</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-3"><span className="w-1.5 h-6 bg-red-600 rounded-full"></span>SYSTEM AUDIT LOGS</h3>
            <div className="space-y-3">
              {transactions.slice(0, 50).map(tx => {
                const user = users.find(u => u.id === tx.userId);
                return (
                  <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${tx.status === TransactionStatus.PENDING ? 'bg-yellow-400 animate-pulse' : tx.status === TransactionStatus.REJECTED ? 'bg-slate-300' : tx.amount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      <div>
                        <p className="font-black text-slate-800 text-[11px] leading-tight">{tx.description} {tx.status && <span className="text-[8px] font-black opacity-40 uppercase ml-1">[{tx.status}]</span>}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">{user?.phone} • {new Date(tx.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    <p className={`font-black text-sm tracking-tighter ${tx.status === TransactionStatus.PENDING ? 'text-yellow-500' : tx.status === TransactionStatus.REJECTED ? 'text-slate-300 line-through' : tx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 animate-fade-in">
             <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-[2rem]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jackpot Mode Locked</p>
                <h4 className="font-black text-slate-800 text-lg">Sequential 5-Ball</h4>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">Payouts fixed at ₹50, ₹500, ₹5k, ₹50k, ₹500k</p>
             </div>
             <div className="pt-6">
                <button 
                  onClick={onLogout}
                  className="w-full py-5 bg-red-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout System
                </button>
             </div>
          </div>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Admin;
