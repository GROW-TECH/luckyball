
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameType, Draw } from '../../types';
import { ENTRY_FEE, GAME_CONFIGS } from '../../constants';

interface BettingProps {
  activeDraw?: Draw;
  onPlaceBet: (bet: any) => Promise<boolean>;
}

const Betting: React.FC<BettingProps> = ({ activeDraw, onPlaceBet }) => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const gameType = decodeURIComponent(type || '') as GameType;
  
  const config = useMemo(() => {
    // Corrected GameType.BALL_5_DRAW to GameType.BALL_5
    return GAME_CONFIGS[gameType] || GAME_CONFIGS[GameType.BALL_5];
  }, [gameType]);

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const maxNumbers = config.balls;

  const toggleNumber = (n: number) => {
    if (selectedNumbers.includes(n)) {
      setSelectedNumbers(prev => prev.filter(num => num !== n));
    } else {
      if (selectedNumbers.length < maxNumbers) setSelectedNumbers(prev => [...prev, n]);
      else setSelectedNumbers(prev => [...prev.slice(1), n]);
    }
  };

  const handleConfirm = async () => {
    if (selectedNumbers.length < maxNumbers) { 
      alert(`Please select ${maxNumbers} numbers for the ${gameType}`); 
      return; 
    }
    if (!activeDraw) { alert("No active draw"); return; }
    
    const success = await onPlaceBet({ 
      gameType, 
      numbers: selectedNumbers, 
      amount: ENTRY_FEE, 
      potentialWin: config.prize, 
      drawId: activeDraw.id 
    });
    
    if (success) {
      if(confirm("Bet placed successfully! Do you want to place another entry?")) {
        setSelectedNumbers([]);
      } else {
        navigate('/history');
      }
    }
  };

  return (
    <div className="p-4 space-y-8 animate-fade-in">
      <div className="flex items-center gap-4 px-2">
        <button onClick={() => navigate(-1)} className="p-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-2xl border border-slate-100 shadow-sm transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{maxNumbers === 1 ? '1-Ball Pick' : `${maxNumbers}-Ball Sequence`}</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Fee: ₹{ENTRY_FEE} Only</p>
        </div>
      </div>

      <div className={`bg-gradient-to-br border p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl relative overflow-hidden ${
        maxNumbers === 1 ? 'from-amber-500 to-amber-700 border-amber-400/30' :
        maxNumbers <= 3 ? 'from-indigo-500 to-indigo-700 border-indigo-400/30' :
        'from-red-500 to-red-800 border-red-400/30'
      }`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase font-black tracking-widest text-white/70 mb-1 opacity-70">Jackpot Prize</p>
          <p className="text-4xl font-black tracking-tighter text-yellow-300">₹{config.prize.toLocaleString()}</p>
        </div>
        <div className="text-right relative z-10">
          <p className="text-[10px] uppercase font-black tracking-widest text-white/70 mb-1 opacity-70">Target</p>
          <p className="text-2xl font-black">{maxNumbers} {maxNumbers === 1 ? 'Ball' : 'Balls'}</p>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6 px-4">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Select Your Numbers</h3>
          <span className="text-[10px] font-black px-3 py-1 bg-slate-900 text-white rounded-full">{selectedNumbers.length}/{maxNumbers}</span>
        </div>
        
        <div className="grid grid-cols-5 gap-4 px-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
            const isSelected = selectedNumbers.includes(n);
            const index = selectedNumbers.indexOf(n);
            return (
              <button
                key={n}
                onClick={() => toggleNumber(n)}
                className={`w-full aspect-square rounded-full flex items-center justify-center text-xl font-black border-2 transition-all duration-300 relative overflow-hidden ${
                  isSelected 
                  ? 'bg-gradient-to-br from-red-400 to-red-700 border-red-500 text-white shadow-xl scale-110' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-red-200 shadow-sm'
                }`}
              >
                {isSelected && (
                  <span className="absolute bottom-1 right-2 text-[8px] font-black opacity-40">{index + 1}</span>
                )}
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex justify-center gap-2">
           {selectedNumbers.length > 0 ? (
             selectedNumbers.map((n, i) => (
               <div key={i} className="w-10 h-10 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-lg border border-slate-700 animate-scale-in">
                 <span className="text-[7px] font-black opacity-40 uppercase">Pos {i+1}</span>
                 <span className="font-black text-sm">{n}</span>
               </div>
             ))
           ) : (
             <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest py-4">Tap numbers above to build sequence</div>
           )}
        </div>
      </section>

      <div className="pt-8 px-2">
        <button
          onClick={handleConfirm}
          className="w-full py-6 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-[2.5rem] font-black text-lg shadow-2xl shadow-red-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 uppercase tracking-[0.2em]"
          disabled={selectedNumbers.length < maxNumbers}
        >
          Place Bet • ₹{ENTRY_FEE}
        </button>
        <p className="text-center text-[10px] font-black text-slate-400 mt-5 uppercase tracking-widest opacity-60">Sequence must match exact draw order</p>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Betting;
