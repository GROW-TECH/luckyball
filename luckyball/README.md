
# Lucky Ball – Setup Instructions

## 1. Database Setup
1. Open your MySQL terminal or phpMyAdmin.
2. Run the commands inside `schema.sql`. This will create the database `luckyball_db` and two default accounts.

## 2. Environment Variables
If running locally, set these in your terminal or a `.env` file:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=luckyball_db
PORT=3001
```

## 3. Install & Run
In the project root, run:
```bash
# Install backend dependencies
npm install

# Start the server
node server.js
```

## 4. Default Login Access
- **Admin Access**: Phone `999` / Password `admin123`
- **Player Access**: Phone `123` / Password `player123` (Starts with ₹1000 balance)

## 5. Development
The frontend is built with React. If you are using a standard build tool:
1. `npm run build` (to generate the `dist` folder)
2. `node server.js` will then serve the UI on `http://localhost:3001`.
