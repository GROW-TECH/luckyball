
import React, { useState, useEffect } from 'react';
import { User, Transaction, TransactionStatus } from '../types';

interface WalletProps {
  user: User;
  transactions: Transaction[];
  onDepositRequest: (amount: number, utr: string) => void;
  // Update to return Promise<boolean> to match App.tsx implementation
  onWithdrawRequest: (amount: number, upiId: string) => Promise<boolean>;
}

const Wallet: React.FC<WalletProps> = ({ user, transactions, onDepositRequest, onWithdrawRequest }) => {
  const [modalType, setModalType] = useState<'deposit' | 'withdraw' | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [utrInput, setUtrInput] = useState<string>('');
  const [upiInput, setUpiInput] = useState<string>(user.upiId || '');

  useEffect(() => {
    if (user.upiId) setUpiInput(user.upiId);
  }, [user.upiId]);

  const UPI_ID = 'luckyball.pay@upi';
  const MERCHANT_NAME = 'Lucky Ball Betting';

  // Mark as async to await onWithdrawRequest which returns Promise<boolean>
  const handleAction = async () => {
    const val = Number(amountInput);
    if (isNaN(val) || val <= 0) return;
    if (modalType === 'deposit') {
      if (!utrInput || utrInput.length < 10) { 
        alert("Please enter a valid 12-digit UTR number after payment"); 
        return; 
      }
      onDepositRequest(val, utrInput);
    } else {
      if (!upiInput || upiInput.length < 5 || !upiInput.includes('@')) {
        alert("Please enter a valid UPI ID for withdrawal");
        return;
      }
      if (user.balance < val) {
        alert("Insufficient balance");
        return;
      }
      await onWithdrawRequest(val, upiInput);
    }
    setModalType(null); 
    setAmountInput(''); 
    setUtrInput('');
  };

  const handleUPIIntent = () => {
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount first");
      return;
    }
    
    const tr = `LB${Date.now()}`;
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Deposit LuckyBall')}&tr=${tr}`;
    
    // Create an invisible anchor tag and click it to force the protocol handler
    const anchor = document.createElement('a');
    anchor.href = upiUrl;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <div className="p-4 space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-[0_25px_50px_-12px_rgba(202,138,4,0.4)] border-4 border-yellow-200/40">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="text-yellow-100 text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">Available Balance</p>
          <h2 className="text-5xl font-black tracking-tighter drop-shadow-xl">₹{user.balance.toLocaleString()}</h2>
          <div className="flex gap-3 mt-8 w-full">
            <button onClick={() => setModalType('deposit')} className="flex-1 bg-white text-red-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Deposit</button>
            <button onClick={() => setModalType('withdraw')} className="flex-1 bg-red-600 text-white border border-red-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Withdraw</button>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
          <div className="w-1 h-5 bg-red-600 rounded-full"></div>
          <h3 className="font-black text-slate-800 text-lg tracking-tight">Recent Activity</h3>
        </div>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
               <p className="text-slate-300 font-black uppercase tracking-widest text-[9px]">No history found</p>
            </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.status === TransactionStatus.PENDING ? 'bg-yellow-50 text-yellow-600' :
                    tx.type === 'deposit' || tx.type === 'win' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {tx.type === 'deposit' || tx.type === 'win' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4"/></svg>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-xs">{tx.description}</h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {new Date(tx.timestamp).toLocaleDateString([], {day:'2-digit', month:'short'})}
                    </p>
                  </div>
                </div>
                <div className={`font-black text-sm tracking-tighter ${tx.amount > 0 ? (tx.status === TransactionStatus.PENDING ? 'text-yellow-500' : 'text-emerald-600') : (tx.status === TransactionStatus.PENDING ? 'text-yellow-500' : 'text-slate-800')}`}>
                  {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-6">
          <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] p-6 shadow-2xl animate-scale-in border-t-4 border-red-600 relative">
            <button onClick={() => setModalType(null)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <div className="text-center mb-6">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{modalType} Funds</h3>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Transaction Portal</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600 font-black text-lg">₹</span>
                <input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-black text-2xl transition-all" />
              </div>

              {modalType === 'deposit' && (
                <div className="space-y-3">
                  <button onClick={handleUPIIntent} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    OPEN UPI APP
                  </button>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-2 text-center">Manual Copy UPI</p>
                    <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-red-50">
                      <span className="font-black text-red-700 text-[10px] truncate mr-2">{UPI_ID}</span>
                      <button onClick={() => { navigator.clipboard.writeText(UPI_ID); alert("UPI Copied!"); }} className="text-[8px] bg-red-600 text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest">Copy</button>
                    </div>
                  </div>
                  <input type="text" value={utrInput} onChange={(e) => setUtrInput(e.target.value)} placeholder="Enter 12-digit UTR" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-black text-[10px] transition-all" />
                </div>
              )}

              {modalType === 'withdraw' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Payout UPI ID</label>
                  <input type="text" value={upiInput} onChange={(e) => setUpiInput(e.target.value)} placeholder="example@upi" className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-red-600 font-black text-sm transition-all" />
                </div>
              )}

              <p className="text-[8px] text-slate-400 text-center font-bold uppercase tracking-widest px-4 leading-relaxed">
                {modalType === 'deposit' ? 'Redirection requires UPI apps on mobile' : 'Double check UPI ID. Verified before payout.'}
              </p>
              
              <button onClick={handleAction} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                Confirm {modalType}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Wallet;
