
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
    user: process.env.DB_USER || 'luckyball_db',
    password: process.env.DB_PASSWORD || 'luckyball_db',
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
app.get('/', (req, res) => {
  res.send('Lucky Ball Server is running.');
});

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

// --- USER MANAGEMENT (Missing Routes Needed by App.tsx) ---
apiRouter.get('/users/:userId', async (req, res) => {
  try {
    const users = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [req.params.userId]);
    if (users.length > 0) res.json(users[0]);
    else res.status(404).json({ error: 'User not found' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/users/:userId/update', async (req, res) => {
  const { name, phone, upiId, password } = req.body;
  try {
    if (password) {
      await query('UPDATE users SET name = ?, phone = ?, upi_id = ?, password = ? WHERE id = ?', [name, phone, upiId, password, req.params.userId]);
    } else {
      await query('UPDATE users SET name = ?, phone = ?, upi_id = ? WHERE id = ?', [name, phone, upiId, req.params.userId]);
    }
    const [user] = await query('SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE id = ?', [req.params.userId]);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// --- ADMIN DRAW ACTIONS ---
apiRouter.post('/admin/draws', async (req, res) => {
  const { cycle } = req.body;
  try {
    const id = `d-${Date.now()}`;
    const now = Date.now();
    const endTime = now + (30 * 60 * 1000); 
    const resultTime = endTime + (5 * 60 * 1000); 
    await query('INSERT INTO draws (id, cycle, start_time, end_time, result_time, is_completed) VALUES (?, ?, ?, ?, ?, 0)', [id, cycle, now, endTime, resultTime]);
    res.json({ success: true, id });
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

    const [bets] = await conn.execute('SELECT * FROM bets WHERE draw_id = ? AND status = "Pending"', [drawId]);
    
    for (const bet of bets) {
      const betNumbers = bet.numbers.split(',').map(Number);
      let isWinner = false;
      let actualWinAmount = 0;

      if (bet.game_type === '1-Ball Match') {
        isWinner = betNumbers[0] === winningNumbers[0];
        actualWinAmount = isWinner ? 50 : 0;
      } else if (bet.game_type === '2-Ball Sequence') {
        isWinner = betNumbers[0] === winningNumbers[0] && betNumbers[1] === winningNumbers[1];
        actualWinAmount = isWinner ? 500 : 0;
      } else if (bet.game_type === '3-Ball Sequence') {
        isWinner = betNumbers[0] === winningNumbers[0] && betNumbers[1] === winningNumbers[1] && betNumbers[2] === winningNumbers[2];
        actualWinAmount = isWinner ? 5000 : 0;
      } else if (bet.game_type === '5-Ball Sequence') {
        let matches = 0;
        for (let i = 0; i < 5; i++) {
          if (betNumbers[i] === winningNumbers[i]) matches++;
          else break;
        }
        if (matches === 5) { isWinner = true; actualWinAmount = 500000; }
        else if (matches === 4) { isWinner = true; actualWinAmount = 50000; }
      }

      if (isWinner && actualWinAmount > 0) {
        await conn.execute('UPDATE bets SET status = "Win", potential_win = ? WHERE id = ?', [actualWinAmount, bet.id]);
        await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [actualWinAmount, bet.user_id]);
        await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, "win", ?, ?, "Approved")', 
          [`tx-win-${bet.id}`, bet.user_id, actualWinAmount, `Won ${bet.game_type}`, Date.now()]);
      } else {
        await conn.execute('UPDATE bets SET status = "Lose" WHERE id = ?', [bet.id]);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) { 
    if (conn) await conn.rollback(); 
    res.status(500).json({ error: err.message }); 
  } finally { 
    if (conn) conn.release(); 
  }
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
    await query('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, utr) VALUES (?, ?, ?, "deposit", "Deposit Request", ?, "Pending", ?)', 
      [id, req.body.userId, req.body.amount, Date.now(), req.body.utr]);
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
    await conn.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
    await conn.execute('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status, upi_id) VALUES (?, ?, ?, "withdrawal", "Withdrawal Request", ?, "Pending", ?)', 
      [id, userId, -amount, Date.now(), upiId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(400).json({ error: err.message }); }
  finally { if (conn) conn.release(); }
});

// --- ADMIN MANAGEMENT ---
apiRouter.get('/admin/users', async (req, res) => {
  try { res.json(await query('SELECT id, phone, name, balance FROM users WHERE is_admin = 0')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/bets', async (req, res) => {
  try { 
    const bets = await query('SELECT * FROM bets ORDER BY timestamp DESC LIMIT 100');
    res.json(bets.map(b => ({ ...b, userId: b.user_id, drawId: b.draw_id, gameType: b.game_type, potentialWin: b.potential_win, numbers: (b.numbers || "").split(',').map(Number) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/draws/all', async (req, res) => {
  try { 
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted, winning_numbers as winningNumbers FROM draws ORDER BY result_time DESC');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/transactions', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, amount, type, description, timestamp, status FROM transactions ORDER BY timestamp DESC LIMIT 200')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/deposits', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, amount, type, description, timestamp, status, utr FROM transactions WHERE type="deposit" AND status="Pending"')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/withdrawals', async (req, res) => {
  try { res.json(await query('SELECT id, user_id as userId, amount, type, description, timestamp, status, upi_id as upiId FROM transactions WHERE type="withdrawal" AND status="Pending"')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/users/:userId/balance', async (req, res) => {
  try {
    const { amount } = req.body;
    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.params.userId]);
    await query('INSERT INTO transactions (id, user_id, amount, type, description, timestamp, status) VALUES (?, ?, ?, "adjustment", "Admin Adjustment", ?, "Approved")', 
      [`adj-${Date.now()}`, req.params.userId, amount, Date.now()]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/deposits/:id/approve', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [tx] = await conn.execute('SELECT user_id, amount FROM transactions WHERE id = ? AND status = "Pending"', [req.params.id]);
    if (tx[0]) {
      await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [tx[0].amount, tx[0].user_id]);
      await conn.execute('UPDATE transactions SET status = "Approved" WHERE id = ?', [req.params.id]);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); }
  finally { if (conn) conn.release(); }
});

apiRouter.post('/admin/deposits/:id/reject', async (req, res) => {
  try { await query('UPDATE transactions SET status = "Rejected" WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/withdrawals/:id/approve', async (req, res) => {
  try { await query('UPDATE transactions SET status = "Approved" WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/admin/withdrawals/:id/reject', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [tx] = await conn.execute('SELECT user_id, amount FROM transactions WHERE id = ? AND status = "Pending"', [req.params.id]);
    if (tx[0]) {
      await conn.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [Math.abs(tx[0].amount), tx[0].user_id]);
      await conn.execute('UPDATE transactions SET status = "Rejected" WHERE id = ?', [req.params.id]);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { if (conn) await conn.rollback(); res.status(500).json({ error: err.message }); }
  finally { if (conn) conn.release(); }
});

app.use('/api', apiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
