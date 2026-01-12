
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Draw, GameType, Bet, BetStatus } from '../types';
import { ENTRY_FEE } from '../constants';

interface HomeProps {
  activeDraw?: Draw;
  draws: Draw[];
  bets: Bet[];
  onAcknowledgeWin: (betId: string) => void;
}

const Confetti: React.FC = () => {
  const pieces = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: ['#facc15', '#ef4444', '#10b981', '#3b82f6', '#ffffff'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      size: 5 + Math.random() * 10,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute top-[-20px] rounded-sm animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall { animation: confetti-fall linear forwards; }
      `}</style>
    </div>
  );
};

const Home: React.FC<HomeProps> = ({ activeDraw, draws, bets, onAcknowledgeWin }) => {
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [winningBet, setWinningBet] = useState<Bet | null>(null);
  const [statusText, setStatusText] = useState('BETTING CLOSES IN');
  
  const dismissedWinIds = useRef<Set<string>>(new Set());

  const updateTimer = useCallback(() => {
    if (!activeDraw) {
      setStatusText('AWAITING NEXT CYCLE');
      setTimeLeft('--:--:--');
      return;
    }

    const now = Date.now();
    const bettingClosed = now >= activeDraw.endTime;
    const resultTimeReached = now >= activeDraw.resultTime;

    if (resultTimeReached) {
      setStatusText('PUBLISHING RESULTS');
      setTimeLeft('PLEASE WAIT...');
    } else if (bettingClosed) {
      setStatusText('BETTING CLOSED');
      const diff = activeDraw.resultTime - now;
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(`RESULT AT ${new Date(activeDraw.resultTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    } else {
      setStatusText('BETTING CLOSES IN');
      const diff = activeDraw.endTime - now;
      const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(`${hours}:${mins}:${secs}`);
    }
  }, [activeDraw]);

  useEffect(() => {
    updateTimer(); // Initial call to prevent 1s delay
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [updateTimer]);

  useEffect(() => {
    const uncelebratedWin = bets.find(b => 
      b.status === BetStatus.WIN && 
      !b.celebrated && 
      !dismissedWinIds.current.has(b.id)
    );
    
    if (uncelebratedWin) {
      setWinningBet(uncelebratedWin);
    } else if (winningBet && !bets.find(b => b.id === winningBet.id && b.status === BetStatus.WIN)) {
      setWinningBet(null);
    }
  }, [bets, winningBet]);

  const handleCloseWinModal = () => {
    if (winningBet) {
      dismissedWinIds.current.add(winningBet.id);
      onAcknowledgeWin(winningBet.id);
      setWinningBet(null);
    }
  };

  const isBettingClosed = activeDraw ? Date.now() >= activeDraw.endTime : true;
  const recentDraws = draws.filter(d => d.isCompleted).slice(0, 3);

  // Helper to determine font size based on string length
  const getTimeFontSize = () => {
    if (timeLeft.length > 8) return 'text-2xl mt-4 px-4';
    return 'text-6xl';
  };

  return (
    <div className="p-4 space-y-8 relative">
      {winningBet && <Confetti />}

      <div className="bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-600 rounded-[2.5rem] p-8 text-white shadow-[0_20px_40px_-15px_rgba(202,138,4,0.4)] relative overflow-hidden border-4 border-yellow-200/30">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className={`px-4 py-1 rounded-full text-[10px] font-black tracking-[0.2em] mb-4 shadow-xl border ${isBettingClosed ? 'bg-slate-800 border-slate-600' : 'bg-red-600 border-red-400'}`}>
            {statusText}
          </div>
          <p className="text-yellow-100 text-xs font-black uppercase tracking-widest mb-1 drop-shadow-md">
            {activeDraw ? `Draw Cycle ${activeDraw.cycle}` : 'Waiting for Admin'}
          </p>
          <div className={`font-black font-mono tracking-tighter drop-shadow-2xl text-white ${getTimeFontSize()}`}>
            {timeLeft}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
            <svg className="w-4 h-4 text-yellow-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Results Published Daily at 09:00 PM</span>
          </div>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="font-black text-slate-800 text-xl tracking-tight">Active Jackpot</h3>
          <button onClick={() => setShowHowToPlay(true)} className="text-[10px] bg-white border border-slate-200 px-4 py-2 rounded-full font-black text-red-600 uppercase tracking-widest shadow-sm hover:bg-red-50 transition-all">RULES</button>
        </div>
        
        <Link 
          to={(!isBettingClosed && activeDraw) ? `/betting/${encodeURIComponent(GameType.BALL_5_DRAW)}` : '#'}
          className={`group bg-white rounded-[3rem] p-8 border-2 border-transparent hover:border-red-500 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_30px_60px_-15px_rgba(239,68,68,0.2)] transition-all duration-500 flex flex-col items-center text-center relative overflow-hidden ${isBettingClosed ? 'opacity-70 grayscale-0 cursor-not-allowed' : ''}`}
          onClick={(e) => { if (isBettingClosed) e.preventDefault(); }}
        >
          <div className="absolute top-0 right-0 p-4">
             <span className={`font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full border ${isBettingClosed ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {isBettingClosed ? 'BETTING CLOSED' : `ENTRY: ₹${ENTRY_FEE}`}
             </span>
          </div>
          <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br flex items-center justify-center mb-6 shadow-2xl transition-transform ${isBettingClosed ? 'from-slate-400 to-slate-600' : 'from-red-500 to-red-800 group-hover:scale-110'}`}>
             <div className="flex -space-x-2">
               {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 font-black text-xs border border-slate-100">?</div>)}
             </div>
          </div>
          <h4 className="font-black text-slate-800 tracking-tight text-2xl group-hover:text-red-600 transition-colors">5-Ball Sequence</h4>
          <p className="text-[11px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Match in order & Win up to</p>
          <p className="text-4xl font-black text-emerald-600 tracking-tighter mt-1">₹5,00,000</p>
          
          <div className={`mt-8 w-full py-5 rounded-2xl text-white text-xs font-black uppercase tracking-[0.3em] transition-colors shadow-lg ${isBettingClosed ? 'bg-slate-300' : 'bg-slate-900 group-hover:bg-red-600'}`}>
            {isBettingClosed ? 'Closed for Result' : 'Enter Draw Now'}
          </div>
        </Link>
      </section>

      {recentDraws.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
            <h3 className="font-black text-slate-800 text-xl tracking-tight">Recent Results</h3>
          </div>
          <div className="space-y-5">
            {recentDraws.map(draw => (
              <div key={draw.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date(draw.resultTime).toLocaleDateString(undefined, {month:'short', day:'numeric'})} Draw</span>
                  <span className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase">Verified</span>
                </div>
                <div className="flex gap-2 items-center">
                  {draw.winningNumbers?.map((n, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center font-black text-slate-700 shadow-sm relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent"></div>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {winningBet && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleCloseWinModal}></div>
          <div className="relative w-full max-w-[340px] bg-gradient-to-b from-yellow-300 to-orange-600 rounded-[3rem] p-8 shadow-[0_0_100px_rgba(250,204,21,0.5)] border-4 border-yellow-200 animate-winner-pop text-center">
             <div className="absolute -top-16 left-1/2 -translate-x-1/2">
                <div className="w-32 h-32 bg-yellow-400 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-trophy-bounce">
                  <svg className="w-16 h-16 text-orange-700" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05l-3.294 2.744.888 3.554a1 1 0 01-1.481 1.061L10 16.338l-3.02 1.51a1 1 0 01-1.481-1.06l.888-3.555-3.294-2.744a1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z"/></svg>
                </div>
             </div>
             <div className="mt-16 space-y-4">
                <h2 className="text-white font-black text-4xl tracking-tighter uppercase leading-none drop-shadow-lg">JACKPOT WINNER!</h2>
                <div className="bg-white/20 backdrop-blur-md py-4 rounded-3xl border border-white/20">
                   <p className="text-yellow-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Prize Credited</p>
                   <p className="text-white text-5xl font-black tracking-tighter">₹{winningBet.potentialWin.toLocaleString()}</p>
                </div>
                <button onClick={handleCloseWinModal} className="w-full py-5 bg-white text-orange-600 rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-[0.2em] text-sm mt-4 border-2 border-orange-100">Collect Prize</button>
             </div>
          </div>
        </div>
      )}

      {showHowToPlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowHowToPlay(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar border-4 border-red-50">
            <button onClick={() => setShowHowToPlay(false)} className="absolute top-8 right-8 p-2 text-slate-400 hover:text-red-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            <div className="text-center mb-10"><h2 className="text-3xl font-black text-slate-800 tracking-tight">Jackpot Rules</h2><p className="text-red-500 font-black text-[10px] uppercase tracking-widest mt-2">Sequential Match Bonus</p></div>
            <div className="space-y-8">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                 <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Daily Schedule</p>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Betting Starts</span><span className="text-emerald-600 font-black">Morning</span></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Betting Closes</span><span className="text-red-600 font-black">08:00 PM</span></div>
                   <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-600">Results Published</span><span className="text-orange-600 font-black">09:00 PM</span></div>
                 </div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200/50">
                <p className="text-[10px] text-yellow-800 text-center font-black uppercase tracking-widest leading-relaxed">Important Logic</p>
                <p className="text-[10px] text-yellow-700 text-center mt-2 font-medium italic">Matches must be in sequence from Ball #1 onwards. One entry costs ₹{ENTRY_FEE}.</p>
              </div>
              <button onClick={() => setShowHowToPlay(false)} className="w-full py-5 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all text-sm uppercase tracking-[0.2em]">I Understand</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes winner-pop { from { opacity: 0; transform: scale(0.5) translateY(50px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-winner-pop { animation: winner-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes trophy-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-trophy-bounce { animation: trophy-bounce 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Home;
