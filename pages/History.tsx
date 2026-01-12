
import React, { useState } from 'react';
import { Bet, Draw, BetStatus } from '../types';

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

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold text-slate-800">My Bets</h2>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'pending', 'win', 'lose'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${
              filter === f 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
              : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredBets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p className="text-slate-400 font-medium">No records found</p>
          </div>
        ) : (
          filteredBets.map(bet => {
            const draw = draws.find(d => d.id === bet.drawId);
            return (
              <div key={bet.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                {bet.status === BetStatus.WIN && (
                  <div className="absolute top-0 right-0 p-2">
                    <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest">Jackpot</span>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-slate-800">{bet.gameType}</h4>
                    <p className="text-[10px] text-slate-400">{new Date(bet.timestamp).toLocaleString()}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    bet.status === BetStatus.WIN ? 'bg-green-100 text-green-700' :
                    bet.status === BetStatus.LOSE ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {bet.status}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-slate-400 font-medium">Numbers:</span>
                  <div className="flex gap-1.5">
                    {bet.numbers.map((n, i) => (
                      <span key={i} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-700">{n}</span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-slate-50 pt-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Bet Amount</p>
                    <p className="font-bold text-slate-800">₹{bet.amount}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Potential Win</p>
                    <p className={`font-black text-lg ${bet.status === BetStatus.WIN ? 'text-green-600' : 'text-indigo-600'}`}>
                      ₹{bet.potentialWin.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default History;
