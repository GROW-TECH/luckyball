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
    host:  'xiadot.com',
    user:  'luckyball_db',
    password:  'luckyball_db',
    database: 'luckyball_db',
    port:3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  //   pool = mysql.createPool({
  //   host: process.env.DB_HOST || 'localhost',
  //   user: process.env.DB_USER || 'luckyball_db',
  //   password: process.env.DB_PASSWORD || 'luckyball_db',
  //   database: process.env.DB_NAME || 'luckyball_db',
  //   port: process.env.DB_PORT || 3306,
  //   waitForConnections: true,
  //   connectionLimit: 10,
  //   queueLimit: 0
  // });

} catch (e) {
  console.error("[DB] Init Error:", e.message);
}

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err);
  });


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
  console.log('[LOGIN] Incoming:', { phone, password, isAdmin }); // Log incoming data
  try {
    if (!pool) {
      console.error('[LOGIN] DB pool is not initialized');
      return res.status(500).json({ error: 'Database connection not initialized' });
    }
    const sql = 'SELECT id, phone, name, balance, is_admin as isAdmin, upi_id as upiId FROM users WHERE phone = ? AND password = ? AND is_admin = ?';
    const params = [phone, password, isAdmin ? 1 : 0];
    // console.log('[LOGIN] SQL:', sql, params); // Log SQL and params
    const users = await query(sql, params);
    // console.log('[LOGIN] Query result:', users);
    if (users && users.length > 0) res.json(users[0]);
    else res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('[LOGIN] Error:', err.stack || err); // Log full error stack
    res.status(500).json({ error: err.message });
  }
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
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth();
    const day = nowIST.getUTCDate();
    const dayStartIST = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).getTime();
    const dayEndIST = new Date(Date.UTC(year, month, day, 18, 29, 59, 999)).getTime();
    const nowISTms = nowIST.getTime();
    
    // console.log('Today (IST):', new Date(nowISTms).toISOString());
    // console.log('Today start:', new Date(dayStartIST).toISOString());
    // console.log('Today end:', new Date(dayEndIST).toISOString());
    
    // Also check what draws exist
    const allDraws = await query('SELECT * FROM draws');
    // console.log('All draws:', allDraws);
    
    // DEBUG: Log the actual times for the draw
    if (allDraws.length > 0) {
      const draw = allDraws[0];
      // console.log('Draw details:', {
      //   id: draw.id,
      //   start_time: new Date(draw.start_time).toISOString(),
      //   end_time: new Date(draw.end_time).toISOString(),
      //   result_time: new Date(draw.result_time).toISOString(),
      //   is_completed: draw.is_completed,
      //   nowISTms: new Date(nowISTms).toISOString(),
      //   end_time_gt_now: draw.end_time > nowISTms
      // });
    }
    
    // MODIFIED QUERY: Remove the end_time > nowISTms condition OR use different logic
    // Option 1: Get todays draw that hasn't completed yet (regardless of end time)
    const draws = await query(
      'SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted FROM draws WHERE start_time >= ? AND start_time <= ? AND is_completed = 0 ORDER BY end_time ASC LIMIT 1', 
      [dayStartIST, dayEndIST]
    );
    
    // console.log('Found draws:', draws);
    
    // Option 2: If you want to show todays draw even after end_time but before result_time
    if (draws.length === 0 && allDraws.length > 0) {
      // Check if we have a draw for today that might have ended but results not published
      const todaysDraws = await query(
        'SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted FROM draws WHERE start_time >= ? AND start_time <= ? ORDER BY end_time ASC LIMIT 1', 
        [dayStartIST, dayEndIST]
      );
      // console.log('Todays draws (including completed):', todaysDraws);
      res.json(todaysDraws[0] || null);
    } else {
      res.json(draws[0] || null);
    }
  } catch (err) { 
    console.error('Error:', err);
    res.json(null); 
  }
});

// Debug: List all draws for today
apiRouter.get('/draws/debug-today', async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime();
  const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, is_completed as isCompleted FROM draws WHERE start_time >= ? AND start_time <= ? ORDER BY start_time ASC', [dayStart, dayEnd]);
  res.json(draws);
});

// Improved: Get today's draw with end_time = 8:00 PM and not completed
apiRouter.get('/draws/today', async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const endTime = new Date(year, month, day, 20, 0, 0, 0).getTime(); // 8:00 PM
    const draw = await query(
      'SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted, winning_numbers as winningNumbers FROM draws WHERE end_time = ? AND is_completed = 0 LIMIT 1',
      [endTime]
    );
    if (draw.length > 0) {
      const d = draw[0];
      res.json({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null });
    } else {
      res.json(null);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/draws/recent', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, winning_numbers as winningNumbers, is_completed as isCompleted FROM draws WHERE is_completed = 1 ORDER BY result_time DESC LIMIT 10');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : [] })));
  } catch (err) { res.json([]); }
});




// Admin: Delete a draw and its bets
apiRouter.delete('/admin/draws/:drawId', async (req, res) => {
  const { drawId } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.execute('DELETE FROM bets WHERE draw_id = ?', [drawId]);
    await conn.execute('DELETE FROM draws WHERE id = ?', [drawId]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// --- ADMIN: CREATE DRAW (START NEW DRAW CYCLE) ---
apiRouter.post('/admin/draws', async (req, res) => {
  try {
    console.log('[CREATE DRAW] Request received');

    const { cycle = 1 } = req.body;

    // ---- CORRECT IST TIMESTAMP CALCULATION ----
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + 5.5 * 60 * 60 * 1000);
    
    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth();
    const day = nowIST.getUTCDate();

    // IST times in milliseconds
    const startTime = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).getTime();   // 00:00 IST
    const endTime = new Date(Date.UTC(year, month, day, 14, 30, 0, 0)).getTime();   // 20:00 IST (8 PM IST = 14:30 UTC)
    const resultTime = new Date(Date.UTC(year, month, day, 15, 30, 0, 0)).getTime(); // 21:00 IST (9 PM IST = 15:30 UTC)

    console.log('[CREATE DRAW] TIMES (IST)', {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      resultTime: new Date(resultTime).toISOString(),
      startTimeMs: startTime,
      endTimeMs: endTime,
      resultTimeMs: resultTime
    });

    // ---- CHECK FOR EXISTING DRAW FOR TODAY ----
    // Get the start of today (00:00 IST) and end of today (23:59:59 IST)
    const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).getTime();
    const todayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).getTime();
    
    const existing = await query(
      `SELECT id FROM draws 
       WHERE start_time >= ? AND start_time <= ?`,
      [todayStart, todayEnd]
    );

    // if (existingDrawToday.length > 0) {
    //   console.warn('[CREATE DRAW] Draw for today already exists:', existingDrawToday[0].id);
    //   return res.status(400).json({ msg: 'A draw for today already exists. Only one draw per day is allowed. New Game Created .' });
    // }

      if (existing.length > 0) {
    // ✅ DRAW EXISTS → RETURN SAME drawId
    return res.json({
      success: true,
      drawId: existing[0].id,
      created: false
    });
  }

    const drawId = `d-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    await query(
      `INSERT INTO draws 
       (id, cycle, start_time, end_time, result_time, is_completed, created_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [drawId, cycle, startTime, endTime, resultTime, new Date().toISOString()]
    );

    console.log('[CREATE DRAW] SUCCESS:', drawId);

    res.json({ 
      success: true, 
      id: drawId,
      times: {
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString(),
        result: new Date(resultTime).toISOString()
      }
    });

  } catch (err) {
    console.error('[CREATE DRAW ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});


// Admin: Create a new game/pool for a draw
apiRouter.post('/admin/games', async (req, res) => {
  const { drawId, poolName, gameType, entryFee, prize } = req.body;
  
  // ADD DEBUG LOGS
  console.log('[CREATE GAME] Full request body:', JSON.stringify(req.body, null, 2));
  console.log('[CREATE GAME] Parsed:', { drawId, poolName, gameType, entryFee, prize });
  
  if (
    !drawId ||
    !poolName ||
    !gameType ||
    !entryFee ||
    !Array.isArray(prize) ||
    prize.length === 0
  ) {
    console.error('[CREATE GAME] Validation failed');
    return res.status(400).json({
      error: 'drawId, poolName, gameType, entryFee, and prize array are required.'
    });
  }
  
  console.log('[CREATE GAME] Validation passed');
  
  const id = `g-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    // ADD SQL DEBUG
    const sql = `INSERT INTO games 
       (id, draw_id, pool_name, game_type, entry_fee, prize, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [id, drawId, poolName, gameType, entryFee, JSON.stringify(prize), Date.now()];
    
    console.log('[CREATE GAME] SQL:', sql);
    console.log('[CREATE GAME] Params:', params);
    
    await query(sql, params);
    
    console.log('[CREATE GAME] SUCCESS - Game ID:', id);

    res.json({ success: true, id });
  } catch (err) {
    console.error('[CREATE GAME ERROR]', err.message);
    console.error('[CREATE GAME ERROR] Stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
});


// Admin: List all games for a draw
apiRouter.get('/admin/games/:drawId', async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM games WHERE draw_id = ? ORDER BY created_at ASC',
      [req.params.drawId]
    );

    const games = rows.map(g => ({
      id: g.id,
      drawId: g.draw_id,
      poolName: g.pool_name,
      gameType: g.game_type,          // 🔥 FIX
      entryFee: g.entry_fee,
      prize: typeof g.prize === 'string' ? JSON.parse(g.prize) : g.prize,
      createdAt: g.created_at,
       isCompleted: g.is_completed === 1,
       resultStatus: g.result_status === 1,
  resultTime: g.result_time,
  winningNumbers: g.winning_numbers
    ? g.winning_numbers.split(',').map(Number)
    : null    }));

    res.json(games);
  } catch (err) {
    console.error('[GET ADMIN GAMES ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});


// Admin: Delete a game/pool
apiRouter.delete('/admin/games/:gameId', async (req, res) => {
  try {
    await query('DELETE FROM games WHERE id = ?', [req.params.gameId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User: List all active games for a draw
apiRouter.get('/games/active/:drawId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT 
        id,
        draw_id,
        pool_name,
        game_type,
        entry_fee,
        prize,
        winning_numbers,
        is_completed,
        result_time
      FROM games
      WHERE draw_id = ?
      ORDER BY created_at ASC`,
      [req.params.drawId]
    );

    const games = rows.map(g => ({
      id: g.id,
      drawId: g.draw_id,
      poolName: g.pool_name,
      gameType: g.game_type,
      entryFee: g.entry_fee,
      prize: JSON.parse(g.prize),
      isCompleted: g.is_completed === 1,
      resultStatus: g.result_status === 1,
      resultTime: g.result_time,
      winningNumbers: g.winning_numbers
        ? g.winning_numbers.split(',').map(Number)
        : null
    }));

    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


apiRouter.post('/bets', async (req, res) => {
  const { userId, gameId, numbers } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [games] = await conn.execute(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );

    if (!games[0]) throw new Error('Invalid game');

    const game = games[0];

    // 🔥 Extract prize correctly
  let prizeData = game.prize;

// If prize stored as string → parse
if (typeof prizeData === 'string') {
  try {
    prizeData = JSON.parse(prizeData);
  } catch {
    prizeData = Number(prizeData);
  }
}

// Extract first slab amount
let winAmount = 0;

if (Array.isArray(prizeData)) {
  winAmount = Number(prizeData[0]?.amount || 0);
} else {
  winAmount = Number(prizeData);
}

if (!winAmount || winAmount <= 0) {
  throw new Error('Invalid game prize');
}


    const [u] = await conn.execute(
      'SELECT balance FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (!u[0] || u[0].balance < game.entry_fee) {
      throw new Error('Insufficient balance');
    }

    const betId = `b-${Date.now()}`;

    await conn.execute(
      `INSERT INTO bets 
       (id, user_id, draw_id, game_id, game_type, numbers, amount, potential_win, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, "Pending", ?)`,
      [
        betId,
        userId,
        game.draw_id,
        gameId,
        game.game_type,
        numbers.join(','),
        game.entry_fee,
        winAmount,   // ✅ correct numeric prize
        Date.now()
      ]
    );

    await conn.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [game.entry_fee, userId]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

apiRouter.get('/bets/user/:userId', async (req, res) => {
  try {
    const bets = await query('SELECT id, user_id as userId, draw_id as drawId, game_id as gameId, game_type as gameType, numbers, amount, potential_win as potentialWin, status, timestamp, celebrated FROM bets WHERE user_id = ? ORDER BY timestamp DESC', [req.params.userId]);
    // console.log(`SELECT id, user_id as userId, draw_id as drawId, game_id as gameId, game_type as gameType, numbers, amount, potential_win as potentialWin, status, timestamp, celebrated FROM bets WHERE user_id = ${req.params.userId} ORDER BY timestamp DESC`);
    // console.log('[GET USER BETS] Retrieved bets:', bets);
    res.json(bets.map(b => ({ ...b, numbers: (b.numbers || "").split(',').map(Number) })));
  } catch (err) { res.json([]); }
});


apiRouter.post('/bets/:betId/acknowledge', async (req, res) => {
  try { await query('UPDATE bets SET celebrated = 1 WHERE id = ?', [req.params.betId]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FINALIZE / RESULTS (PER GAME) ---
apiRouter.post('/admin/games/finalize', async (req, res) => {
  const { gameId, winningNumbers } = req.body;

  if (!gameId || !Array.isArray(winningNumbers)) {
    return res.status(400).json({
      error: 'gameId and winningNumbers are required'
    });
  }




  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 🔒 Lock game row
    const [gameRows] = await conn.execute(
      'SELECT is_completed FROM games WHERE id = ? FOR UPDATE',
      [gameId]
    );

    if (!gameRows[0]) {
      throw new Error('Game not found');
    }

    if (gameRows[0].is_completed === 1) {
      return res.status(403).json({
        error: 'Result already declared'
      });
    }


    // ✅ Mark game completed
    await conn.execute(
      `UPDATE games
       SET winning_numbers = ?, is_completed = 1, result_time = ?
       WHERE id = ?`,
      [winningNumbers.join(','), Date.now(), gameId]
    );

    // 🎯 Evaluate bets
    const [bets] = await conn.execute(
      'SELECT * FROM bets WHERE game_id = ? AND status = "Pending"',
      [gameId]
    );

  for (const bet of bets) {
  const betNumbers = bet.numbers.split(',').map(Number);

  const isWinner =
    betNumbers.length === winningNumbers.length &&
    betNumbers.every((n, i) => n === winningNumbers[i]);

  if (isWinner) {
    const winAmount = Number(bet.potential_win);

    if (!winAmount || winAmount <= 0) {
      throw new Error(`Invalid win amount for bet ${bet.id}`);
    }

    await conn.execute(
      'UPDATE bets SET status = "Win" WHERE id = ?',
      [bet.id]
    );

    await conn.execute(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [winAmount, bet.user_id]
    );

    await conn.execute(
      `INSERT INTO transactions
       (id, user_id, amount, type, description, timestamp, status)
       VALUES (?, ?, ?, 'win', ?, ?, 'Approved')`,
      [
        `tx-win-${bet.id}`,
        bet.user_id,
        winAmount,
        `Won ${bet.game_type}`,
        Date.now()
      ]
    );
  } else {
    await conn.execute(
      'UPDATE bets SET status = "Lose" WHERE id = ?',
      [bet.id]
    );
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
    const rows = await query(`
      SELECT 
        b.id,
        b.user_id,
        b.draw_id,
        b.game_id,
        b.numbers,
        b.amount,
        b.potential_win,
        b.status,
        b.timestamp,
        g.pool_name,
        g.game_type,
        g.entry_fee
      FROM bets b
      JOIN games g ON g.id = b.game_id
      ORDER BY b.timestamp DESC
      LIMIT 200
    `);

    const bets = rows.map(b => ({
      id: b.id,
      userId: b.user_id,
      drawId: b.draw_id,
      gameId: b.game_id,          // 🔥 THIS FIXES ANALYZE ENTRIES
      gameType: b.game_type,
      poolName: b.pool_name,
      entryFee: b.entry_fee,
      numbers: (b.numbers || '').split(',').map(Number),
      amount: b.amount,
      potentialWin: b.potential_win,
      status: b.status,
      timestamp: b.timestamp
    }));

    res.json(bets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


apiRouter.get('/admin/draws/all', async (req, res) => {
  try { 
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted, winning_numbers as winningNumbers FROM draws ORDER BY result_time DESC');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/admin/draws', async (req, res) => {
  try {
    const draws = await query('SELECT id, cycle, start_time as startTime, end_time as endTime, result_time as resultTime, is_completed as isCompleted, winning_numbers as winningNumbers FROM draws ORDER BY result_time DESC');
    res.json(draws.map(d => ({ ...d, winningNumbers: d.winningNumbers ? d.winningNumbers.split(',').map(Number) : null })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
// --- SETTLEMENT AFTER 9PM ---
apiRouter.post('/admin/games/settle', async (req, res) => {
  const now = Date.now();
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Get games ready for settlement
    const [games] = await conn.execute(`
      SELECT g.*
      FROM games g
      JOIN draws d ON g.draw_id = d.id
      WHERE g.is_completed = 1
      AND g.winning_numbers IS NOT NULL
      AND d.result_time <= ?
    `, [now]);

    for (const game of games) {

      const winningNumbers = game.winning_numbers.split(',').map(Number);

      const [bets] = await conn.execute(
        'SELECT * FROM bets WHERE game_id = ? AND status = "Pending"',
        [game.id]
      );

      for (const bet of bets) {
        const betNumbers = bet.numbers.split(',').map(Number);

        const isWinner =
          betNumbers.length === winningNumbers.length &&
          betNumbers.every((n, i) => n === winningNumbers[i]);

        if (isWinner) {
          const winAmount = Number(bet.potential_win);

          await conn.execute(
            'UPDATE bets SET status = "Win" WHERE id = ?',
            [bet.id]
          );

          await conn.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [winAmount, bet.user_id]
          );

          await conn.execute(
            `INSERT INTO transactions
             (id, user_id, amount, type, description, timestamp, status)
             VALUES (?, ?, ?, 'win', ?, ?, 'Approved')`,
            [
              `tx-win-${bet.id}`,
              bet.user_id,
              winAmount,
              `Won ${bet.game_type}`,
              Date.now()
            ]
          );

        } else {
          await conn.execute(
            'UPDATE bets SET status = "Lose" WHERE id = ?',
            [bet.id]
          );
        }
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
// --- AUTO CLOSE GAME AT 8 PM ---
apiRouter.post('/admin/games/close-if-time', async (req, res) => {
  const now = Date.now();

  try {
    await pool.execute(
      `UPDATE games g
       JOIN draws d ON g.draw_id = d.id
       SET g.is_completed = 1
       WHERE g.is_completed = 0
       AND d.end_time <= ?`,
      [now]
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
apiRouter.post('/admin/games/declare-result', async (req, res) => {
  const { gameId, winningNumbers } = req.body;

  if (!gameId || !Array.isArray(winningNumbers)) {
    return res.status(400).json({
      error: 'gameId and winningNumbers are required'
    });
  }

  try {

    const [games] = await pool.execute(
      'SELECT result_status FROM games WHERE id = ?',
      [gameId]
    );

    if (!games[0]) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // 🚨 If already declared
    if (games[0].result_status === 1) {
      return res.status(400).json({
        error: 'Result already declared'
      });
    }

    // ✅ Store result + mark declared
    await pool.execute(
      `UPDATE games 
       SET winning_numbers = ?, 
           result_status = 1
       WHERE id = ?`,
      [winningNumbers.join(','), gameId]
    );

    console.log("✅ Result declared for game:", gameId);

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Declare result error:", err);
    res.status(500).json({ error: err.message });
  }
});


setInterval(async () => {
  const now = Date.now();
  console.log('\n==============================');
  console.log('⏰ AUTO JOB RUNNING:', new Date(now).toLocaleString());
  console.log('==============================');

  try {

    // 1️⃣ AUTO CLOSE AT 8PM
    const [closeResult] = await pool.execute(`
      UPDATE games g
      JOIN draws d ON g.draw_id = d.id
      SET g.is_completed = 1
      WHERE g.is_completed = 0
      AND d.end_time <= ?
    `, [now]);

    console.log('🔒 Games Auto Closed:', closeResult.affectedRows);


    // 2️⃣ FIND GAMES READY FOR SETTLEMENT
    const [games] = await pool.execute(`
      SELECT g.*, d.result_time
      FROM games g
      JOIN draws d ON g.draw_id = d.id
      WHERE g.is_completed = 1
      AND g.winning_numbers IS NOT NULL
      AND d.result_time <= ?
    `, [now]);

    console.log('🎯 Games Ready For Settlement:', games.length);


    for (const game of games) {

      console.log(`➡ Processing Game: ${game.id}`);

      const winningNumbers = game.winning_numbers.split(',').map(Number);

      const [bets] = await pool.execute(
        'SELECT * FROM bets WHERE game_id = ? AND status = "Pending"',
        [game.id]
      );

      console.log(`📝 Pending Bets Found: ${bets.length}`);

      for (const bet of bets) {

        const betNumbers = bet.numbers.split(',').map(Number);

        const isWinner =
          betNumbers.length === winningNumbers.length &&
          betNumbers.every((n, i) => n === winningNumbers[i]);

        if (isWinner) {

          const winAmount = Number(bet.potential_win);

          console.log(`🏆 WINNER FOUND → Bet: ${bet.id} | User: ${bet.user_id} | Amount: ${winAmount}`);

          await pool.execute(
            'UPDATE bets SET status = "Win" WHERE id = ?',
            [bet.id]
          );

          await pool.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [winAmount, bet.user_id]
          );

          await pool.execute(
            `INSERT INTO transactions
             (id, user_id, amount, type, description, timestamp, status)
             VALUES (?, ?, ?, 'win', ?, ?, 'Approved')`,
            [
              `tx-win-${bet.id}`,
              bet.user_id,
              winAmount,
              `Won ${bet.game_type}`,
              Date.now()
            ]
          );

        } else {

          console.log(`❌ Losing Bet → ${bet.id}`);

          await pool.execute(
            'UPDATE bets SET status = "Lose" WHERE id = ?',
            [bet.id]
          );
        }
      }

      console.log(`✅ Settlement Completed For Game: ${game.id}`);
    }

    console.log('✔ AUTO JOB FINISHED SUCCESSFULLY');

  } catch (err) {
    console.error('🚨 AUTO JOB ERROR:', err.message);
  }

}, 60000); // every 1 minute


app.use('/api', apiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
