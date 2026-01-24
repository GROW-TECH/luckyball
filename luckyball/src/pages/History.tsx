
import React, { useState } from 'react';
import { Bet, Draw, BetStatus, GameType } from '../../types';

interface HistoryProps {
  bets: Bet[];
  draws: Draw[];
}

const History: React.FC<HistoryProps> = ({ bets, draws }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'win' | 'lose'>('all');

  const filteredBets = bets.filter(b => {
    if (filter === 'all') return true;
    return b.status.toLowerCase() === filter;
  });

  const getRequiredMatchCount = (gameType: GameType) => {
    if (gameType === GameType.BALL_1) return 1;
    if (gameType === GameType.BALL_2) return 2;
    if (gameType === GameType.BALL_3) return 3;
    return 5;
  };

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Bet History</h2>
        <div className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{bets.length} Total</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar px-2">
        {['all', 'pending', 'win', 'lose'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all ${
              filter === f 
              ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
              : 'bg-white border-slate-100 text-slate-400 hover:border-red-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredBets.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest">No matching records</p>
          </div>
        ) : (
          filteredBets.map(bet => {
            const draw = draws.find(d => d.id === bet.drawId);
            const requiredCount = getRequiredMatchCount(bet.gameType);
            
            return (
              <div key={bet.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                {bet.status === BetStatus.WIN && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-emerald-500 text-white text-[8px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-[0.2em] shadow-sm">Verified Win</div>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h4 className="font-black text-slate-800 text-base tracking-tight">{bet.gameType}</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {new Date(bet.timestamp).toLocaleDateString([], {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                    bet.status === BetStatus.WIN ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    bet.status === BetStatus.LOSE ? 'bg-red-50 text-red-600 border border-red-100' : 
                    'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {bet.status}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Your Pick:</span>
                      <div className="flex gap-1.5">
                        {bet.numbers.map((n, i) => (
                          <span key={i} className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-xs font-black text-slate-700 shadow-sm">{n}</span>
                        ))}
                      </div>
                    </div>
                    
                    {draw?.isCompleted && (
                      <div className="flex items-center justify-between border-t border-slate-200/50 pt-3">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Draw Result:</span>
                        <div className="flex gap-1.5">
                          {draw.winningNumbers?.slice(0, 5).map((n, i) => {
                            const isTarget = i < requiredCount;
                            const isMatch = isTarget && n === bet.numbers[i];
                            return (
                              <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-sm relative ${
                                !isTarget ? 'bg-slate-100 text-slate-300' :
                                isMatch ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-red-500 text-white shadow-red-100'
                              }`}>
                                {n}
                                {isTarget && (
                                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white border border-slate-200"></div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Entry Fee</p>
                    <p className="font-black text-slate-800 text-sm">₹{bet.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">{bet.status === BetStatus.WIN ? 'Win Amount' : 'Potential Win'}</p>
                    <p className={`font-black text-xl tracking-tighter ${bet.status === BetStatus.WIN ? 'text-emerald-600' : 'text-slate-400'}`}>
                      ₹{bet.potentialWin.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default History;
