import React, { useState } from 'react';
import { adminApi } from '../adminApi';

interface Draw {
  id: string;
  cycle: number;
  startTime: number;
  endTime: number;
  isCompleted: boolean;
  winningNumbers?: number[];
}

interface User {
  id: string;
  name: string;
  phone: string;
  balance: number;
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
}

interface Bet {
  id: string;
  userId: string;
  drawId: string;
  numbers: number[];
  amount: number;
  timestamp: number;
}

enum TransactionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

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
  draws,
  users,
  bets,
  transactions,
  depositRequests,
  withdrawalRequests,
  onCreateDraw,
  onFinalizeDraw,
  onUpdateUserBalance,
  onApproveDeposit,
  onRejectDeposit,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'draws' | 'users' | 'requests' | 'history' | 'settings'>('draws');
  const [requestSubTab, setRequestSubTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [editingDraw, setEditingDraw] = useState<string | null>(null);
  const [viewingBets, setViewingBets] = useState<string | null>(null);
  const [winningInput, setWinningInput] = useState<string>('');
  const [creatingDraw, setCreatingDraw] = useState(false);

  const handleCreateDraw = async (cycle: 1 | 2) => {
    if (creatingDraw) return;

    setCreatingDraw(true);

    try {
      // Call the parent's onCreateDraw which uses adminApi
      await onCreateDraw(cycle);

      alert('✅ Draw created successfully!');
    } catch (error: any) {
      console.error('Error creating draw:', error);
      alert(`❌ Failed to create draw: ${error.message || 'Please try again.'}`);
    } finally {
      setCreatingDraw(false);
    }
  };

  const handleFinalize = (drawId: string) => {
    const winningNumbers = winningInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (winningNumbers.length !== 5) {
      alert("Please enter exactly 5 winning numbers in sequence.");
      return;
    }
    onFinalizeDraw(drawId, winningNumbers)
      .then(() => {
        // Optionally, refresh the list of draws after finalizing
        fetchDraws(); // Make sure to update the draw list after finalization
        alert('Draw finalized successfully!');
      })
      .catch((error) => {
        console.error('Error finalizing draw:', error);
        alert(`❌ Failed to finalize draw: ${error.message || 'Please try again.'}`);
      });

    setEditingDraw(null);
    setWinningInput('');
  };

  const fetchDraws = async () => {
    try {
      const response = await fetch('https://xiadot.com/luckyball.in/api/admin/admin_get_draws.php'); // Adjust the API endpoint as necessary
      const data = await response.json();
      setDraws(data); // Assuming setDraws is a state setter for the draws array
    } catch (error) {
      console.error('Failed to fetch draws:', error);
    }
  };

  const activeDraws = draws.filter(d => !d.isCompleted);

  const getBetsForDraw = (drawId: string) => bets.filter(b => b.drawId === drawId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-2 sticky top-0 z-30 shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-2">
          {[{ id: 'draws', label: 'Draws' }, { id: 'requests', label: `Pending (${depositRequests.length + withdrawalRequests.length})` }, { id: 'users', label: 'Users' }, { id: 'history', label: 'Global Tx' }, { id: 'settings', label: 'Settings' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] uppercase font-black tracking-widest whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
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
            <button
              onClick={() => handleCreateDraw(1)}
              disabled={creatingDraw}
              className={`w-full py-5 bg-white text-red-600 rounded-3xl font-black border-2 border-dashed border-red-200 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm ${creatingDraw ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {creatingDraw ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  CREATING DRAW...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  START NEW DRAW CYCLE
                </>
              )}
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
                                        {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      </div>
    </div>
  );
};

export default Admin;
