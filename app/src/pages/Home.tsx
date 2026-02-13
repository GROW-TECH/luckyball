import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Draw, GameType, Game, Bet, BetStatus } from '../types';
import { ENTRY_FEE, GAME_CONFIGS } from '../../constants';
import { api } from '../api';

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
  const [todaysDraw, setTodaysDraw] = useState<Draw | null>(null);
  const [loadingDraw, setLoadingDraw] = useState(true);
  const [games, setGames] = useState<Game[]>([]);

  const dismissedWinIds = useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  // Helper to format currency dynamically
  const formatCurrency = (amount: number): string => {
    if (amount >= 10000000) {
      // Crores (1 Cr = 10,000,000)
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      // Lakhs (1 L = 100,000)
      return `₹${(amount / 100000).toFixed(2)} L`;
    } else if (amount >= 1000) {
      // Thousands (1 K = 1,000)
      return `₹${(amount / 1000).toFixed(2)} K`;
    } else {
      return `₹${amount}`;
    }
  };
  const isResultDeclared = (game: Game) => {
  return game.isCompleted && game.winningNumbers && game.winningNumbers.length > 0;
};


  // Helper to get today's 8 PM IST and 9 PM IST as timestamps
  const getTodayISTTimes = () => {
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth();
    const date = nowIST.getUTCDate();
    // 8:00 PM IST = 20:00 IST = 14:30 UTC
    const endTimeIST = new Date(Date.UTC(year, month, date, 14, 30, 0, 0)).getTime();
    // 9:00 PM IST = 21:00 IST = 15:30 UTC
    const resultTimeIST = new Date(Date.UTC(year, month, date, 15, 30, 0, 0)).getTime();
    return { endTimeIST, resultTimeIST };
  };

  const updateTimer = useCallback(() => {
    const now = Date.now();
    const { endTimeIST, resultTimeIST } = getTodayISTTimes();
    const bettingClosed = now >= endTimeIST;
    const resultTimeReached = now >= resultTimeIST;

    if (resultTimeReached) {
      setStatusText('PUBLISHING RESULTS');
      setTimeLeft('PLEASE WAIT...');
    } else if (bettingClosed) {
      setStatusText('BETTING CLOSED');
      setTimeLeft(`RESULT AT 09:00 PM`);
    } else {
      setStatusText('BETTING CLOSES IN');
      const diff = endTimeIST - now;
      const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeLeft(`${hours}:${mins}:${secs}`);
    }
  }, []);
useEffect(() => {
  if (!todaysDraw?.id) return;

  let cancelled = false;

  api.getGamesForDraw(todaysDraw.id)
    .then(games => {
      console.log("Games", games);
      
      if (!cancelled) setGames(games);
    })
    .catch(() => {
      if (!cancelled) setGames([]);
    });

  return () => {
    cancelled = true;
  };
}, [todaysDraw?.id]);

  useEffect(() => {
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeDraw, updateTimer]);

  const getUserBetForGame = (gameId: string) => {
  return bets.find(b => b.gameId === gameId);
};

  useEffect(() => {
    console.log("Bets updated", bets);
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
  }, [bets]);

  const handleCloseWinModal = () => {
    if (winningBet) {
      dismissedWinIds.current.add(winningBet.id);
      onAcknowledgeWin(winningBet.id);
      setWinningBet(null);
    }
  };

useEffect(() => {
  let isMounted = true;

  const fetchActiveDraw = () => {
    setLoadingDraw(true);
    api.get('/draws/active')
      .then(draw => {
        console.log("Draw",draw);
        if (isMounted) setTodaysDraw(draw);
      })
      .catch(() => {
        if (isMounted) setTodaysDraw(null);
      })
      .finally(() => {
        if (isMounted) setLoadingDraw(false);
      });
  };

  // initial call
  fetchActiveDraw();

  // run every 5 minutes
  const interval = setInterval(fetchActiveDraw, 5 * 60 * 1000);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
}, []);


  // Use new timer logic for isBettingClosed
  const isBettingClosed = Date.now() >= getTodayISTTimes().endTimeIST;

  const recentDraws = draws.filter(d => d.isCompleted).slice(0, 3);

  const gameTypes = [
    { type: GameType.BALL_5, name: '5-Ball Jackpot', prize: '5,00,000' },
    { type: GameType.BALL_3, name: '3-Ball Sequence', prize: '5,000' },
    { type: GameType.BALL_2, name: '2-Ball Sequence', prize: '500' },
    { type: GameType.BALL_1, name: '1-Ball Pick', prize: '50' },
  ];

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
          <div className="font-black font-mono tracking-tighter drop-shadow-2xl text-white text-5xl">
            {timeLeft}
          </div>
          <div className="mt-4 flex items-center gap-2 bg-black/10 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
            <svg className="w-4 h-4 text-yellow-200" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">DAILY RESULTS @ 09:00 PM</span>
          </div>
        </div>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6 px-2">
          <h3 className="font-black text-slate-800 text-xl tracking-tight">Game Lobby</h3>
          <button onClick={() => setShowHowToPlay(true)} className="text-[10px] bg-white border border-slate-200 px-4 py-2 rounded-full font-black text-red-600 uppercase tracking-widest shadow-sm hover:bg-red-50 transition-all">RULES</button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
        {games.map((game) => {
  const isDeclared = isResultDeclared(game);
  const userBet = getUserBetForGame(game.id);

  const handleBetClick = (e: React.MouseEvent) => {
    if (!todaysDraw) {
      e.preventDefault();
      return;
    }

    // RESULT DECLARED
    if (isDeclared) {
      // 🚫 User did not bet
      if (!userBet) {
        e.preventDefault();
        return;
      }

      // ✅ User did bet → view result
      navigate(`/betting/${encodeURIComponent(game.gameType)}`, {
        state: {
          activeDraw: todaysDraw,
          selectedGameId: game.id,
          viewResult: true
        }
      });
      return;
    }

    // NORMAL BETTING
    navigate(`/betting/${encodeURIComponent(game.gameType)}`, {
      state: {
        activeDraw: todaysDraw,
        selectedGameId: game.id
      }
    });
  };

const totalPrize = (() => {
  if (!game.prize) return 0;

  // If string → try parse
  let prizeData = game.prize;

  if (typeof prizeData === 'string') {
    try {
      prizeData = JSON.parse(prizeData);
    } catch {
      return Number(prizeData) || 0;
    }
  }

  // New slab format
  if (Array.isArray(prizeData)) {
    return prizeData.reduce((sum, slab) => {
      if (typeof slab === 'number') return sum + slab;
      if (slab?.amount) return sum + Number(slab.amount);
      return sum;
    }, 0);
  }

  // Old single prize
  return Number(prizeData) || 0;
})();

  return (
    <div
      key={game.id}
      role="button"
      tabIndex={0}
      onClick={handleBetClick}
      className={`relative overflow-hidden transition-all duration-300
        ${
          isDeclared
            ? userBet
              ? 'cursor-pointer ring-2 ring-emerald-300'
              : 'cursor-default opacity-60'
            : 'hover:scale-[1.02] cursor-pointer'
        }
      `}
    >
      <div className={`relative bg-white rounded-2xl p-5 border-2 shadow-md
        ${isDeclared ? 'border-emerald-300' : 'border-slate-100'}
      `}>

        {/* USER RESULT BADGE */}
        {userBet && isDeclared && (
          <div className={`absolute top-3 left-3 px-3 py-1 rounded-full
            text-[9px] font-black uppercase tracking-widest
            ${userBet.status === BetStatus.WIN
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-400 text-white'}
          `}>
            {userBet.status === BetStatus.WIN ? 'You Won' : 'You Lost'}
          </div>
        )}

        {/* RESULT RIBBON */}
        {isDeclared && (
          <div className="absolute top-3 right-3 bg-emerald-600 text-white
                          text-[9px] font-black px-3 py-1 rounded-full">
            Result
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-start mb-3">
          <div>
           <p className="text-slate-500 text-[11px] font-bold uppercase">
  win {Array.isArray(game.prize) ? game.prize.length : 1} prize
</p>

            <h3 className="text-slate-900 text-2xl font-black">
              {game.gameType}
            </h3>
          </div>

          <div className={`rounded-full px-4 py-2 text-sm font-black
            ${isDeclared ? 'bg-slate-300 text-slate-600' : 'bg-slate-900 text-white'}
          `}>
            ENTRY ₹{game.entryFee}
          </div>
        </div>

        {/* PRIZE */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-3xl font-black text-slate-900">
            {formatCurrency(totalPrize)}
          </p>

          {/* RESULT NUMBERS */}
          {isDeclared && (
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <p className="text-[10px] font-black text-emerald-700 uppercase mb-2">
                Winning Numbers
              </p>
              <div className="flex gap-2">
                {game.winningNumbers.map((n, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-emerald-600
                               text-white flex items-center justify-center font-black">
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
})}


        </div>
        {loadingDraw ? (
          <div className="text-center text-slate-400 font-bold mt-4">Loading draw...</div>
        ) : !todaysDraw && (
          <div className="text-center text-red-500 font-bold mt-4">No active draw available for today.</div>
        )}
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
                <div className="flex gap-3 items-center">
                  {draw.winningNumbers?.map((n, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div className="w-11 h-11 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center font-black text-slate-700 shadow-sm relative overflow-hidden group hover:border-red-200 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent"></div>
                        {n}
                      </div>
                      <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">B{i+1}</span>
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
                <h2 className="text-white font-black text-4xl tracking-tighter uppercase leading-none drop-shadow-lg">WINNER!</h2>
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
            <div className="text-center mb-10"><h2 className="text-3xl font-black text-slate-800 tracking-tight">Game Rules</h2><p className="text-red-500 font-black text-[10px] uppercase tracking-widest mt-2">Sequential Match Rules</p></div>
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-slate-500 text-[11px] leading-relaxed mb-4">
                  All bets are matched against the first N numbers of the daily 5-ball draw.
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-700">1-Ball Match</span><span className="text-emerald-600 font-black text-xs">Win ₹50</span></div>
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-700">2-Ball Sequence</span><span className="text-emerald-600 font-black text-xs">Win ₹500</span></div>
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-700">3-Ball Sequence</span><span className="text-emerald-600 font-black text-xs">Win ₹5,000</span></div>
                  <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-700">5-Ball Jackpot</span><span className="text-emerald-600 font-black text-xs">Win ₹5,00,000</span></div>
                </div>
              </div>
              <p className="text-[10px] font-medium text-slate-400 text-center italic">Example: If draw is 1-2-3-4-5, a 2-ball bet on [1, 2] wins ₹500.</p>
              <button onClick={() => setShowHowToPlay(false)} className="w-full py-5 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-[2rem] font-black shadow-2xl active:scale-95 transition-all text-sm uppercase tracking-[0.2em]">Start Betting</button>
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