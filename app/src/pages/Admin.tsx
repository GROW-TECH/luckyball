import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Draw, User, Transaction, TransactionStatus, Bet, Game } from '../types';
import { api } from '../api';

interface AdminProps {
  draws: Draw[];
  users: User[];
  bets: Bet[];
  transactions: Transaction[];
  depositRequests: Transaction[];
  withdrawalRequests: Transaction[];
  onCreateDraw: (cycle: 1 | 2) => void | Promise<void>;
  onFinalizeDraw: (drawId: string, winning: number[], gameType: string) => void | Promise<void>;
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
  const [showCreateDrawForm, setShowCreateDrawForm] = useState(false);
  const [newDrawCycle, setNewDrawCycle] = useState<1 | 2>(1);

  const activeDraws = useMemo(() => draws.filter(d => !d.isCompleted), [draws]);
  // Timer state for each active draw
  const [drawTimers, setDrawTimers] = useState<{[drawId: string]: { timeLeft: string, status: string }} >({});
  const [gamesByDraw, setGamesByDraw] = useState<{[drawId: string]: Game[]}>({});

type PrizeSlab = {
  from: number;
  to: number;
  amount: number;
};

type NewGameForm = {
  poolName?: string;
  gameType?: string;
  entryFee?: number;
  prizes: PrizeSlab[];
};


const [newGame, setNewGame] = useState<Record<string, NewGameForm>>({
  new: {
    poolName: '',
    gameType: '',
    entryFee: 0,
    prizes: [{ from: 1, to: 1, amount: 0 }]
  }
});
  const handleDeleteDraw = useCallback(async (drawId: string) => {
    if (window.confirm('Are you sure you want to delete this draw and all its bets?')) {
      await api.delete(`/admin/draws/${drawId}`);
      window.location.reload(); // Or trigger a state update to refresh draws
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      const closeTime = new Date(year, month, day, 20, 0, 0, 0).getTime(); // 8:00 PM
      const resultTime = new Date(year, month, day, 21, 0, 0, 0).getTime(); // 9:00 PM
      const timers: {[drawId: string]: { timeLeft: string, status: string }} = {};
      activeDraws.forEach(draw => {
        let status = '';
        let timeLeft = '';
        if (now < closeTime) {
          status = 'BETTING CLOSES IN';
          const diff = closeTime - now;
          const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
          const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
          const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
          timeLeft = `${h}:${m}:${s}`;
        } else if (now < resultTime) {
          status = 'BETTING CLOSED';
          timeLeft = 'RESULT AT 09:00 PM';
        } else {
          status = 'PUBLISHING RESULTS';
          timeLeft = 'PLEASE WAIT...';
        }
        timers[draw.id] = { timeLeft, status };
      });
      setDrawTimers(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeDraws]);

  useEffect(() => {
    async function fetchGames() {
      const result: {[drawId: string]: Game[]} = {};
      for (const draw of activeDraws) {
        try {
          result[draw.id] = await api.getGamesForDraw(draw.id);
        } catch {}
      }
      setGamesByDraw(result);
    }
    if (activeDraws.length > 0) fetchGames();
  }, [activeDraws]);

  const handleAddGame = async (drawId: string) => {
    const g = newGame[drawId];
    if (
      !g?.poolName ||
      !g?.gameType ||
      !g?.entryFee ||
      !g?.prizes?.length
    ) {
      alert('Fill all fields and add at least one prize');
      return;
    }

    await api.createGame({
      drawId,
      poolName: g.poolName,
      gameType: g.gameType,
      entryFee: g.entryFee,
      prize: g.prizes
    });
    
    setNewGame(prev => ({
      ...prev,
      [drawId]: { prizes: [{ from: 1, to: 1, amount: 0 }]
}
    }));
    
    // Refresh games
    const updated = await api.getGamesForDraw(drawId);
    setGamesByDraw(prev => ({ ...prev, [drawId]: updated }));
  };

const handleCreateDrawAndGame = async () => {
  const g = newGame['new'];
  console.log(g);
  
  if (!g?.poolName || !g?.gameType || !g?.entryFee || !g?.prizes?.length) {
    alert('Fill all fields');
    return;
  }

  try {
    // 🔥 Backend decides drawId
    const res = await api.post('/admin/draws', { cycle: newDrawCycle });
    const drawId = res.drawId || res.id; // Depending on backend response structure

    // console.log(res);

    await api.createGame({
      drawId,
      poolName: g.poolName,
      gameType: g.gameType,
      entryFee: g.entryFee,
      prize: g.prizes
    });

    setShowCreateDrawForm(false);
setNewGame({
  new: { prizes: [{ from: 1, to: 1, amount: 0 }] }
});

    alert('Draw & Game created');
    window.location.reload();

  } catch (e: any) {
    alert(e.message || 'Failed');
  }
};



  const handleDeleteGame = async (drawId: string, gameId: string) => {
    if (!window.confirm('Delete this game/pool?')) return;
    await api.deleteGame(gameId);
    const updated = await api.getGamesForDraw(drawId);
    setGamesByDraw(prev => ({ ...prev, [drawId]: updated }));
  };

  const handleFinalize = (drawId: string, gameType: string) => {
    const winningNumbers = winningInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    if (winningNumbers.length === 0) {
      alert("Please enter the winning sequence.");
      return;
    }
    onFinalizeDraw(drawId, winningNumbers, gameType);
    setEditingDraw(null);
    setWinningInput('');
  };

  const getBetsForDraw = (drawId: string) => bets.filter(b => b.drawId === drawId);
  useEffect(() => {
   console.log('Bets updated:', bets);
  }, [bets]);


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
            <button 
              onClick={() => {setShowCreateDrawForm(!showCreateDrawForm); setNewDrawCycle(1);}} 
              className="w-full py-5 bg-white    text-red-600 rounded-3xl font-black border-2 border-dashed border-red-200 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/>
              </svg>
              START NEW DRAW CYCLE
            </button>

            {showCreateDrawForm && (
              <div className="mt-3 p-3 bg-slate-100 rounded-xl border border-slate-200">
                {/* Cycle Selection */}
                <div className="flex gap-2 mb-3">
                  {/* <button
                    onClick={() => setNewDrawCycle(1)}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      newDrawCycle === 1 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    Cycle 1
                  </button> */}
                  {/* <button
                    onClick={() => setNewDrawCycle(2)}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      newDrawCycle === 2 
                      ? 'bg-red-600 text-white shadow-md' 
                      : 'bg-white text-slate-400 border border-slate-200'
                    }`}
                  >
                    Cycle 2
                  </button> */}
                </div>

                {/* Pool Name + Game Type */}
                <div className="flex gap-2 mb-3">
                  <input
                    className="flex-1 p-2 rounded border border-slate-200 text-xs"
                    placeholder="Pool Name"
                    value={newGame['new']?.poolName || ''}
                    onChange={e =>
                      setNewGame(prev => ({
                        ...prev,
                        'new': {
                          ...prev['new'],
                          poolName: e.target.value,
                          prizes: prev['new']?.prizes ||[{ from: 1, to: 1, amount: 0 }]

                        }
                      }))
                    }
                  />

                  <select
                    className="flex-1 p-2 rounded border border-slate-200 text-xs"
                    value={newGame['new']?.gameType || ''}
                    onChange={e =>
                      setNewGame(prev => ({
                        ...prev,
                        'new': {
                          ...prev['new'],
                          gameType: e.target.value,
                          prizes: prev['new']?.prizes || [{ from: 1, to: 1, amount: 0 }]

                        }
                      }))
                    }
                  >
                    <option value="">Game Type</option>
                    <option value="1-Ball Match">1-Ball Match</option>
                    <option value="2-Ball Sequence">2-Ball Sequence</option>
                    <option value="3-Ball Sequence">3-Ball Sequence</option>
                    <option value="4-Ball Sequence">4-Ball Sequence</option>
                    <option value="5-Ball Sequence">5-Ball Sequence</option>
                  </select>
                </div>

                {/* Entry Fee */}
                <input
                  className="w-full p-2 mb-3 rounded border border-slate-200 text-xs"
                  type="number"
                  placeholder="Entry Fee"
                  value={newGame['new']?.entryFee || ''}
                  onChange={e =>
                    setNewGame(prev => ({
                      ...prev,
                      'new': {
                        ...prev['new'],
                        entryFee: Number(e.target.value),
                        prizes: prev['new']?.prizes || [{ from: 1, to: 1, amount: 0 }]

                      }
                    }))
                  }
                />

                {/* Prizes */}
             {/* Prize Slabs */}
<div className="space-y-3 mb-3">
  {(newGame['new']?.prizes || [{ from: 1, to: 1, amount: 0 }]).map((slab, index) => (
    <div key={index} className="flex gap-2 items-center">
      
      <input
        type="number"
        placeholder="From"
        className="w-16 p-2 rounded border border-slate-200 text-xs"
        value={slab.from}
        onChange={e => {
const updated = [...(newGame['new']?.prizes || [])];
          updated[index].from = Number(e.target.value);
          setNewGame(prev => ({
            ...prev,
            'new': { ...prev['new'], prizes: updated }
          }));
        }}
      />

      <span className="text-xs font-black">to</span>

      <input
        type="number"
        placeholder="To"
        className="w-16 p-2 rounded border border-slate-200 text-xs"
        value={slab.to}
        onChange={e => {
          const updated = [...newGame['new'].prizes];
          updated[index].to = Number(e.target.value);
          setNewGame(prev => ({
            ...prev,
            'new': { ...prev['new'], prizes: updated }
          }));
        }}
      />

      <input
        type="number"
        placeholder="Amount"
        className="flex-1 p-2 rounded border border-slate-200 text-xs"
        value={slab.amount}
        onChange={e => {
          const updated = [...newGame['new'].prizes];
          updated[index].amount = Number(e.target.value);
          setNewGame(prev => ({
            ...prev,
            'new': { ...prev['new'], prizes: updated }
          }));
        }}
      />

      {newGame['new'].prizes.length > 1 && (
        <button
          onClick={() => {
            const updated = newGame['new'].prizes.filter((_, i) => i !== index);
            setNewGame(prev => ({
              ...prev,
              'new': { ...prev['new'], prizes: updated }
            }));
          }}
          className="px-2 py-1 bg-red-100 text-red-600 rounded font-black"
        >
          ×
        </button>
      )}
    </div>
  ))}
</div>


                {/* Add Prize */}
               <button
  type="button"
  onClick={() => {
    const slabs = newGame['new']?.prizes || [];
    const lastTo = slabs.length ? slabs[slabs.length - 1].to : 0;

    setNewGame(prev => ({
      ...prev,
      'new': {
        ...prev['new'],
        prizes: [
          ...slabs,
          { from: lastTo + 1, to: lastTo + 1, amount: 0 }
        ]
      }
    }));
  }}
  className="w-full py-2 mb-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
>
  + Add Prize Slab
</button>


                {/* Submit - Create Draw with Game */}
                <button
                  className="w-full bg-red-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-200 active:scale-95 transition-all"
                  onClick={handleCreateDrawAndGame}
                >
                  Create Draw with Game/Pool
                </button>
              </div>
            )}

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
                  const timer = drawTimers[draw.id] || { timeLeft: '', status: '' };
                  const games = gamesByDraw[draw.id] || [];
                  // console.log("Games",games);
                  // console.log('Draw:', draw);
                  const prizes = newGame[draw.id]?.prizes ?? [{ from: 1, to: 1, amount: 0 }];

                  return (
                    <div key={draw.id} className="bg-white rounded-[2.5rem] shadow-md border border-slate-100 overflow-hidden mb-8">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-6"style={{alignItems:"center",justifyContent:"center",justifyItems:"center"}} >
                          <div>
                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">LIVE DRAW: {draw.id.slice(-6)}</span>
                            <h4 className="text-xl font-black text-slate-800 tracking-tight">Cycle {draw.cycle}</h4>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Ends: 08:00 PM</p>
                            <div className="mt-2 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.2em] shadow border bg-yellow-50 border-yellow-200 text-yellow-800 inline-block">
                              {timer.status} {timer.timeLeft && <span className="ml-2 text-slate-900">{timer.timeLeft}</span>}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2" >
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Entries</p>
                            <p className="text-2xl font-black text-emerald-600 tracking-tighter animate-pulse">{drawBets.length}</p>
<button
  onClick={() => handleDeleteDraw(draw.id)}
  className="mt-2 w-7 h-7 flex items-center justify-center 
             bg-red-100 text-red-600 rounded-full 
             border border-red-200 hover:bg-red-200 
             transition-all"
  title="Delete Draw"
>
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0V5a1 1 0 011-1h4a1 1 0 011 1v2"
    />
  </svg>
</button>
                          </div>
                        </div>
                        <div className="mb-6">
                          <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Games / Pools</h5>
                          <div className="space-y-2">
                            {games.map(game => (
                              <div key={game.id} className="flex flex-col gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="font-black text-slate-800 text-sm">{game.poolName} <span className="text-[10px] text-slate-400 ml-2">({game.gameType})</span></div>
<div className="text-[10px] text-slate-500">
  Entry: ₹{game.entryFee} | Prize: {
    Array.isArray(game.prize)
      ? game.prize
          .map((p: any) => `₹${p.amount} (${p.from}-${p.to})`)
          .join(', ')
      : `₹${game.prize}`
  }
</div>
                                  </div>
                                    {!game.resultStatus  && (
                                  <button onClick={() => handleDeleteGame(draw.id, game.id)} className="text-xs text-red-500 px-2 py-1 rounded bg-red-50 border border-red-100 hover:bg-red-100">Delete</button>
                                   )}
                                  </div>
                                {/* Bets for this game */}
                                <div className="flex gap-2 mt-2">
                                  <button onClick={() => setViewingBets(viewingBets === game.id ? null : game.id)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${viewingBets === game.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-100 shadow-sm'}`}>Analyze Entries</button>
                                {!game.resultStatus  ? (
                                  <button onClick={() => setEditingDraw(editingDraw === game.id ? null : game.id)}
                                   className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                                    ${editingDraw === game.id ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' 
                                    : 'bg-white text-red-600 border-red-100'}`}>Declare Results</button>
                             
                                ) : (
                                   <div
  className="flex items-center justify-center text-green-600"
  title="Result Declared"
>
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 13l4 4L19 7"
    />
  </svg>
</div>

                                  )}
                                     </div>
                                {editingDraw === game.id && (
                                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 space-y-2 animate-fade-in mb-3">
                                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest ml-2">Winning Sequence</label>
                                    <input placeholder="e.g. 1, 3, 5, 7, 9" className="w-full p-2 bg-white border-2 border-red-100 rounded-xl outline-none focus:border-red-600 font-black text-sm transition-all" value={winningInput} onChange={e => setWinningInput(e.target.value)} />
                                   <button
  onClick={async () => {
    try {
      console.log("🟡 Declare button clicked for game:", game.id);
      console.log("🟡 Raw winning input:", winningInput);

      const numbersArray = winningInput
        .split(',')
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n));

      console.log("🟢 Parsed winning numbers:", numbersArray);

      if (numbersArray.length === 0) {
        alert("Enter valid winning numbers");
        return;
      }

      const response = await api.post('/admin/games/declare-result', {
        gameId: game.id,
        winningNumbers: numbersArray
      });

      console.log("✅ API Response:", response);

      alert("Result stored successfully");

      setEditingDraw(null);
      setWinningInput('');

    } catch (error: any) {
      console.error("❌ Declare Result Error:", error);
      alert(error?.response?.data?.error || "Failed to store result");
    }
  }}
  className="w-full bg-red-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-red-200 active:scale-95 transition-all mt-2"
>
  Submit Results
</button>

                                  </div>
                                )}
                                {viewingBets === game.id && (
                                  <div className="space-y-2 animate-fade-in border-t border-slate-100 pt-3">
                                    {bets.filter(b => b.gameId === game.id).length === 0 ? (
                                      <div className="py-4 text-center bg-slate-100 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-slate-300 font-black text-[9px] uppercase tracking-widest">No entries yet...</p>
                                      </div>
                                    ) : (
                                      bets.filter(b => b.gameId === game.id).map(bet => {
                                        const user = users.find(u => u.id === bet.userId);
                                        return (
                                          <div key={bet.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm space-y-1">
                                            <div className="flex justify-between items-center">
                                              <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
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
                                                  <div key={i} className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700 shadow-inner relative overflow-hidden group">
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
                            ))}
                            
                            {/* Add New Game Form for This Draw */}
                        
                          </div>
                        </div>
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
