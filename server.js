
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let pool;
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'luckyball_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} catch (e) {
  console.error("[DB] Init Error:", e.message);
}

async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

const apiRouter = express.Router();

// --- AUTH ---
apiRouter.post('/login', async (req, res) => {
  const { phone, password, isAdmin } = req.body;
  try {
    const users = await query(
      'SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE phone = ? AND password = ? AND is_admin = ?',
      [phone, password, isAdmin ? 1 : 0]
    );
    if (users && users.length > 0) res.json(users[0]);
    else res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/signup', async (req, res) => {
  const { phone, password, name } = req.body;
  try {
    const userId = `u-${Date.now()}`;
    await query('INSERT INTO users (id, phone, name, balance, password, is_admin) VALUES (?, ?, ?, 1000, ?, 0)', [userId, phone, name, password]);
    const [user] = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [userId]);
    res.json(user);
  } catch (err) { res.status(400).json({ error: 'Registration failed' }); }
});

// --- DRAWS ---
apiRouter.get('/draws/active', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted FROM draws WHERE is_completed = 0 AND result_time > ? ORDER BY end_time ASC LIMIT 1', [Date.now()]);
    res.json(draws[0] || null);
  } catch (err) { res.json(null); }
});

apiRouter.get('/draws/recent', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, winning_numbers as winningNumbers, is_completed as isCompleted FROM draws WHERE is_completed = 1 ORDER BY result_time DESC LIMIT 10');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : [] })));
  } catch (err) { res.json([]); }
});

// --- BETS ---
apiRouter.post('/bets', async (req, res) => {
  const { userId, drawId, gameType, numbers, amount, potentialWin } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [u] = await conn.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u[0] || u[0].balance < amount) throw new Error("Insufficient balance");
    const betId = `b-${Date.now()}`;
    await conn.execute('INSERT INTO bets (id, user_id, draw_id, game_type, numbers, amount, potential_win, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, "Pending", ?)', 
      [betId, userId, drawId, gameType, numbers.join(','), amount, potentialWin, Date.now()]);
    await conn.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, "bet", ?, ?, "Approved")', 
      [`tx-${betId}`, userId, -amount, `Bet: ${gameType}`, Date.now()]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(400).json({ error: err.message }); }
  finally { if (conn) conn.release(); }
});

apiRouter.get('/bets/user/:userId', async (req, res) => {
  try {
    const bets = await query('SELECT id, user_id as userId, draw_id as drawId, game_type as gameType, numbers, amount, potential_win as potentialWin, status, timestamp, celebrated FROM bets WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    res.json(bets.map(b => ({ ...b, numbers: (b.numbers || "").split(',').map(Number) })));
  } catch (err) { res.json([]); }
});

apiRouter.post('/bets/:betId/acknowledge', async (req, res) => {
  try { await query('UPDATE bets SET celebrated = 1 WHERE id = ?', [req.params.betId]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- WALLET ---
apiRouter.get('/transactions/:userId', async (req, res) => {
  try { 
    const txs = await query('SELECT id, user_id as userId, amount, type, description, timestamp, status, utr, upi_id as upiId FROM transactions WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    res.json(txs); 
  }
  catch (err) { res.json([]); }
});

apiRouter.post('/deposits', async (req, res) => {
  try {
    const id = `tx-dep-${Date.now()}`;
    await query('INSERT INTO deposit_requests (id, user_id, amount, utr, status, timestamp) VALUES (?, ?, ?, ?, "Pending", ?)', 
      [id, req.body.userId, req.body.amount, req.body.utr, Date.now()]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/withdrawals', async (req, res) => {
  const { userId, amount, upiId } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [u] = await conn.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u[0] || u[0].balance < amount) throw new Error("Insufficient balance");

    const id = `tx-wit-${Date.now()}`;
    // Deduct balance immediately
    await conn.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    
    // Insert into withdrawal_requests table
    await conn.execute('INSERT INTO withdrawal_requests (id, user_id, amount, upi_id, status, timestamp) VALUES (?, ?, ?, ?, "Pending", ?)', 
      [id, userId, amount, upiId, Date.now()]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) { 
    if (conn) await conn.rollback(); 
    res.status(400).json({ error: err.message }); 
  } finally { 
    if (conn) conn.release(); 
  }
});

apiRouter.get('/users/:userId', async (req, res) => {
  try {
    const users = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [req.params.userId]);
    res.json(users[0] || null);
  } catch (err) { res.json(null); }
});

apiRouter.post('/users/:userId/update', async (req, res) => {
  try {
    await query('UPDATE users SET name = ?, upi_id = ? WHERE id = ?', [req.body.name, req.body.upiId, req.params.userId]);
    const [user] = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [req.params.userId]);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ADMIN ---
apiRouter.get('/admin/users', async (req, res) => {
  try { res.json(await query('SELECT id, phone, name, balance, is_admin as isAdmin FROM users')); }
  catch (err) { res.json([]); }
});

apiRouter.get('/admin/bets', async (req, res) => {
  try {
    const bets = await query('SELECT id, user_id as userId, draw_id as drawId, game_type as gameType, numbers, amount, potential_win as potentialWin, status, timestamp, celebrated FROM bets');
    res.json(bets.map(b => ({ ...b, numbers: (b.numbers || "").split(',').map(Number) })));
  } catch (err) { res.json([]); }
});

apiRouter.get('/admin/draws/all', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, winning_numbers as winningNumbers, is_completed as isCompleted FROM draws ORDER BY result_time DESC');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : [] })));
  } catch (err) { res.json([]); }
});

apiRouter.get('/admin/transactions', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, amount, type, description, timestamp, status, utr, upi_id as upiId FROM transactions ORDER BY timestamp DESC LIMIT 100')); }
  catch (err) { res.json([]); }
});

apiRouter.get('/admin/deposits', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, amount, "deposit" as type, "Deposit" as description, timestamp, status, utr FROM deposit_requests WHERE status = "Pending"')); }
  catch (err) { res.json([]); }
});

apiRouter.get('/admin/withdrawals', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, -amount as amount, "withdrawal" as type, "Withdrawal Request" as description, timestamp, status, upi_id as upiId FROM withdrawal_requests WHERE status = "Pending"')); }
  catch (err) { res.json([]); }
});

apiRouter.post('/admin/draws', async (req, res) => {
  const st = Date.now();
  const dur = 24 * 60 * 60 * 1000;
  const et = st + dur;
  const rt = et + (15 * 60 * 1000);
  const id = `draw-${Date.now()}`;
  try {
    await query('INSERT INTO draws (id, cycle, start_time, end_time, result_time, is_completed) VALUES (?, ?, ?, ?, ?, 0)', [id, req.body.cycle || 1, st, et, rt]);
    res.json({ id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/draws/finalize', async (req, res) => {
  const { drawId, winningNumbers } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const winStr = winningNumbers.join(',');
    await conn.execute('UPDATE draws SET winning_numbers = ?, is_completed = 1 WHERE id = ?', [winStr, drawId]);
    const [bets] = await conn.execute('SELECT id, user_id, numbers FROM bets WHERE draw_id = ? AND status = "Pending"', [drawId]);
    for (const bet of bets) {
      const uNums = bet.numbers.split(',').map(Number);
      let matches = 0;
      for (let i = 0; i < 5; i++) {
        if (uNums[i] === winningNumbers[i]) matches++;
        else break;
      }
      let prize = 0;
      if (matches === 1) prize = 50; 
      else if (matches === 2) prize = 500; 
      else if (matches === 3) prize = 5000; 
      else if (matches === 4) prize = 50000; 
      else if (matches === 5) prize = 500000;

      const st = prize > 0 ? 'Win' : 'Lose';
      if (prize > 0) {
        await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [prize, bet.user_id]);
        await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, "win", "Jackpot Payout", ?, "Approved")', [`tx-win-${bet.id}`, bet.user_id, prize, Date.now()]);
      }
      await conn.execute('UPDATE bets SET status = ?, potential_win = ? WHERE id = ?', [st, prize, bet.id]);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); } 
  finally { if (conn) conn.release(); }
});

apiRouter.post('/admin/users/:userId/balance', async (req, res) => {
  try {
    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [req.body.amount, req.params.userId]);
    await query('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, "deposit", "Admin Credit", ?, "Approved")', [`tx-adj-${Date.now()}`, req.params.userId, req.body.amount, Date.now()]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/deposits/:id/approve', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [reqs] = await conn.execute('SELECT * FROM deposit_requests WHERE id = ?', [req.params.id]);
    const dreq = reqs[0];
    
    await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [dreq.amount, dreq.user_id]);
    await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, utr) VALUES (?, ?, ?, "deposit", "Deposit Approved", ?, "Approved", ?)', 
      [dreq.id, dreq.user_id, dreq.amount, Date.now(), dreq.utr]);
    await conn.execute('DELETE FROM deposit_requests WHERE id = ?', [req.params.id]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); } 
  finally { if (conn) conn.release(); }
});

apiRouter.post('/admin/deposits/:id/reject', async (req, res) => {
  try { await query('DELETE FROM deposit_requests WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/withdrawals/:id/approve', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [reqs] = await conn.execute('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    const wreq = reqs[0];
    
    await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, upi_id) VALUES (?, ?, ?, "withdrawal", "Withdrawal Approved", ?, "Approved", ?)', 
      [wreq.id, wreq.user_id, -wreq.amount, Date.now(), wreq.upi_id]);
    await conn.execute('DELETE FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); } 
  finally { if (conn) conn.release(); }
});

apiRouter.post('/admin/withdrawals/:id/reject', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [reqs] = await conn.execute('SELECT * FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    const wreq = reqs[0];
    
    // Refund user
    await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [wreq.amount, wreq.user_id]);
    await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, upi_id) VALUES (?, ?, ?, "withdrawal", "Withdrawal Rejected", ?, "Rejected", ?)', 
      [`rej-${wreq.id}`, wreq.user_id, 0, Date.now(), wreq.upi_id]);
    await conn.execute('DELETE FROM withdrawal_requests WHERE id = ?', [req.params.id]);
    
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); } 
  finally { if (conn) conn.release(); }
});

app.use('/api', apiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
});
