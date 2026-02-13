import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GameType, Draw, Game, Bet } from '../types';
import { ENTRY_FEE, GAME_CONFIGS } from '../../constants';
import { api } from '../api';
import "../style.css";

interface BettingProps {
  activeDraw?: Draw;
  onPlaceBet: (bet: any) => Promise<boolean>;
  bets?: Bet[];
}

const Betting: React.FC<BettingProps> = ({ activeDraw: propActiveDraw, onPlaceBet, bets = [] }) => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const gameType = decodeURIComponent(type || '') as GameType;
  const [blastKey, setBlastKey] = useState(0);

const selectedGameId =
  (location.state as any)?.selectedGameId || null;

  // Prefer activeDraw from location.state, fallback to prop
  const activeDraw = (location.state && (location.state as any).activeDraw) || propActiveDraw;
  
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  // Helper to format currency dynamically
const formatCurrency = React.useCallback((amount: number): string => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(2)} K`;
  return `₹${amount}`;
}, []);


const gamesFetchedRef = React.useRef<string | null>(null);

React.useEffect(() => {
  if (!activeDraw?.id) return;

  // already fetched for this draw → skip
  if (gamesFetchedRef.current === activeDraw.id) return;

  gamesFetchedRef.current = activeDraw.id;

  api.getGamesForDraw(activeDraw.id).then(g => {
    setGames(g);

    // only auto-select first game ONCE
setSelectedGame(prev => {
  if (prev) return prev;

  if (selectedGameId) {
    return g.find(game => game.id === selectedGameId) || g[0] || null;
  }

  return g[0] || null;
});
  });
}, [activeDraw?.id]);

  const config = useMemo(() => {
    if (selectedGame) {
      // Use balls from gameType string
      if (selectedGame.gameType.startsWith('1-')) return { balls: 1, prize: selectedGame.prize };
      if (selectedGame.gameType.startsWith('2-')) return { balls: 2, prize: selectedGame.prize };
      if (selectedGame.gameType.startsWith('3-')) return { balls: 3, prize: selectedGame.prize };
      if (selectedGame.gameType.startsWith('4-')) return { balls: 4, prize: selectedGame.prize };
      if (selectedGame.gameType.startsWith('5-')) return { balls: 5, prize: selectedGame.prize };
      return { balls: 5, prize: selectedGame.prize };
    }
    return GAME_CONFIGS[gameType] || GAME_CONFIGS[GameType.BALL_5];
  }, [selectedGame, gameType]);

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
  if (selectedNumbers.length < config.balls) {
    alert(`Please select ${config.balls} numbers for the ${selectedGame?.gameType || gameType}`);
    return;
  }

  if (!activeDraw || !selectedGame) {
    alert("No active draw or game");
    return;
  }

  try {
    const success = await onPlaceBet({
      gameId: selectedGame.id,
      gameType: selectedGame.gameType,
      numbers: selectedNumbers,
      amount: selectedGame.entryFee,
      potentialWin: selectedGame.prize,
      drawId: activeDraw.id
    });

    if (success) {
      if (confirm("Bet placed successfully! Do you want to place another entry?")) {
        setSelectedNumbers([]);
      } else {
        navigate('/history');
      }
    }
  } catch (err: any) {
    const rawMessage =
      err?.response?.data?.error ||
      err?.message ||
      "Unable to place bet";

    if (rawMessage.toLowerCase().includes("insufficient")) {
      alert("Insufficient Wallet Balance");
    } else {
      alert(rawMessage);
    }
  }
};


  // Get my previous bet for this game
const myPreviousBets = useMemo(() => {
  if (!selectedGame) return [];
  return bets
    .filter(b => b.gameId === selectedGame.id)
    .slice() // avoid mutating original
    .reverse();
}, [bets, selectedGame?.id]);


const gameResultDeclared =
  selectedGame?.isCompleted && selectedGame?.winningNumbers?.length > 0;

const latestBet = myPreviousBets[0] || null;
const numbersMatch =
  latestBet &&
  selectedGame?.winningNumbers &&
  latestBet.numbers.length === selectedGame.winningNumbers.length &&
  latestBet.numbers.every(
    (n, i) => Number(n) === Number(selectedGame.winningNumbers[i])
  );

  
const isWin =
  latestBet?.status === 'Win' || numbersMatch;

const isLose =
  gameResultDeclared &&
  latestBet &&
  !isWin;
  const isResultView = gameResultDeclared && latestBet;

React.useEffect(() => {
  if (gameResultDeclared && isWin) {
    // force remount for animation
    setBlastKey(prev => prev + 1);
  }
}, [gameResultDeclared, isWin]);

  // Debug logging
React.useEffect(() => {
  if (selectedGame) {
    console.log('Selected Game:', selectedGame);
  }
  if (myPreviousBets.length > 0) {
    console.log('My Previous Bets:', myPreviousBets);
  }
}, [selectedGame, myPreviousBets]);

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
        config.balls === 1 ? 'from-amber-500 to-amber-700 border-amber-400/30' :
        config.balls <= 3 ? 'from-indigo-500 to-indigo-700 border-indigo-400/30' :
        'from-red-500 to-red-800 border-red-400/30'
      }`}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase font-black tracking-widest text-white/70 mb-1 opacity-70">Jackpot Prize</p>
          <p className="text-4xl font-black tracking-tighter text-yellow-300">
₹{
  selectedGame && Array.isArray(selectedGame.prize)
    ? selectedGame.prize.reduce((sum, slab) => sum + Number(slab.amount || 0), 0).toLocaleString()
    : selectedGame?.prize?.toLocaleString()
}
            </p>
        </div>
        <div className="text-right relative z-10">
          <p className="text-[10px] uppercase font-black tracking-widest text-white/70 mb-1 opacity-70">Target</p>
          <p className="text-2xl font-black">{config.balls} {config.balls === 1 ? 'Ball' : 'Balls'}</p>
        </div>
      </div>
{gameResultDeclared && latestBet && (
  <section className="px-2">
    <div
      className={`relative overflow-hidden rounded-3xl p-6 border shadow-xl text-center
        animate-result-in
        ${isWin
          ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border-emerald-400'
          : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300'}
      `}
    >
      {/* 🎊 PAPER BLAST (WIN ONLY) */}
     {isWin && (
  <div
    key={blastKey}
    className="absolute inset-0 pointer-events-none"
  >
    {[...Array(14)].map((_, i) => (
      <span key={i} className={`paper paper-${i}`} />
    ))}
  </div>
)}


      {/* HEADER */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className={`text-3xl ${isWin ? 'animate-bounce' : 'opacity-70'}`}>
          {isWin ? '🎉' : '😔'}
        </span>
        <h2
          className={`text-2xl font-black
            ${isWin ? 'text-emerald-700' : 'text-slate-600'}
          `}
        >
          {isWin ? 'Congratulations!' : 'Better Luck Next Time'}
        </h2>
      </div>

      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-5">
        {isWin ? 'You Won This Game' : 'This Time You Did Not Win'}
      </p>

      {/* NUMBERS */}
      <div className="flex justify-center gap-6 mb-5">
        {/* YOUR NUMBERS */}
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
            Your Pick
          </p>
          <div className="flex gap-2 justify-center">
            {latestBet.numbers.map((n, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow
                  ${isWin
                    ? 'bg-slate-900 text-white animate-pop'
                    : 'bg-slate-400 text-white'}
                `}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* WINNING NUMBERS */}
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
            Result
          </p>
          <div className="flex gap-2 justify-center">
            {selectedGame.winningNumbers.map((n, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-black shadow
                  ${isWin
                    ? 'bg-emerald-600 text-white animate-pop'
                    : 'bg-slate-500 text-white'}
                `}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRIZE */}
      {isWin ? (
        <div className="mt-2 animate-prize-pulse">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 opacity-70">
            Amount Won
          </p>
          <p className="text-4xl font-black text-emerald-700">
           ₹{latestBet?.potentialWin?.toLocaleString()}

          </p>
        </div>
      ) : (
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          Try Again In Next Draw
        </p>
      )}
    </div>
  </section>
)}

{!isResultView && (

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
)}
      {/* Prizes Breakdown Section */}
{!isResultView && selectedGame && Array.isArray(selectedGame.prize) && (
  <section className="px-2">
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <h4 className="text-red-600 text-base font-black mb-4 text-center">
        Prize Details
      </h4>

      <div className="space-y-3">
        {selectedGame.prize.map((slab, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center
                       rounded-xl bg-slate-50 border border-slate-100
                       px-4 py-3"
          >
            <span className="text-slate-600 text-xs font-black uppercase tracking-wide">
              {slab.from === slab.to
                ? `${slab.from} Winner`
                : `${slab.from} - ${slab.to} Winners`}
            </span>

            <span className="text-slate-900 text-sm font-black">
              {formatCurrency(Number(slab.amount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
)}




  <section className="px-2">
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
      <h4 className="text-red-600 text-base font-black mb-3 text-center">
        My Bets ({myPreviousBets.length})
      </h4>

      {/* Dynamic grid: 2 columns for 1–2 balls, 1 column for 3+ balls */}
      <div
        className={`grid gap-3 ${
          maxNumbers <= 2 ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {myPreviousBets.map((bet, betIndex) => (
          <div
            key={bet.id}
            className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 animate-fade-in"
            style={{ animationDelay: `${betIndex * 40}ms` }}
          >
            <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest text-center">
              Bet #{betIndex + 1}
            </p>

            {/* Numbers */}
            <div
              className={`grid gap-2 justify-items-center ${
                maxNumbers <= 2
                  ? 'grid-cols-2'
                  : maxNumbers === 3
                  ? 'grid-cols-3'
                  : maxNumbers === 4
                  ? 'grid-cols-4'
                  : 'grid-cols-5'
              }`}
            >
              {bet.numbers.map((num, idx) => (
                <div
                  key={idx}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-rose-600
                             flex items-center justify-center text-white text-sm font-black
                             shadow-md animate-scale-in"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>



      <div className="pt-8 px-2">
       <button
  onClick={handleConfirm}
  disabled={
    selectedNumbers.length < config.balls ||
    !selectedGame ||
    gameResultDeclared
  }
  className="w-full py-6 bg-gradient-to-r from-red-600 to-red-800
             text-white rounded-[2.5rem] font-black text-lg shadow-2xl
             disabled:opacity-40 disabled:cursor-not-allowed"
>
  {isResultView ? 'Result Declared' : `Place Bet • ₹${selectedGame?.entryFee}`}
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