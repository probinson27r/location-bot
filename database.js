const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('./config');

class Database {
    constructor() {
        this.dbPath = config.databasePath;
        this.ensureDataDirectory();
        this.db = null;
    }

    ensureDataDirectory() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    teams_user_id TEXT UNIQUE NOT NULL,
                    display_name TEXT NOT NULL,
                    employee_number TEXT,
                    email TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS location_responses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date DATE NOT NULL,
                    response_time DATETIME NOT NULL,
                    work_location TEXT NOT NULL,
                    morning_location TEXT,
                    afternoon_location TEXT,
                    reminder_count INTEGER DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                );

                CREATE TABLE IF NOT EXISTS pending_reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    date DATE NOT NULL,
                    reminder_count INTEGER DEFAULT 0,
                    last_reminder_time DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(user_id, date)
                );
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    console.error('Error creating tables:', err);
                    reject(err);
                } else {
                    console.log('Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    async insertOrUpdateUser(teamsUserId, displayName, employeeNumber, email) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO users (teams_user_id, display_name, employee_number, email)
                VALUES (?, ?, ?, ?)
            `;
            
            this.db.run(sql, [teamsUserId, displayName, employeeNumber, email], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getUserByTeamsId(teamsUserId) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE teams_user_id = ?';
            
            this.db.get(sql, [teamsUserId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async saveLocationResponse(userId, date, workLocation, morningLocation = null, afternoonLocation = null, reminderCount = 0) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO location_responses 
                (user_id, date, response_time, work_location, morning_location, afternoon_location, reminder_count)
                VALUES (?, ?, datetime('now'), ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [userId, date, workLocation, morningLocation, afternoonLocation, reminderCount], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async hasUserRespondedToday(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM location_responses WHERE user_id = ? AND date = ?';
            
            this.db.get(sql, [userId, date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count > 0);
                }
            });
        });
    }

    async getLatestLocationForUser(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM location_responses 
                WHERE user_id = ? AND date = ? 
                ORDER BY response_time DESC 
                LIMIT 1
            `;
            
            this.db.get(sql, [userId, date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserLocationHistory(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM location_responses 
                WHERE user_id = ? AND date = ? 
                ORDER BY response_time ASC
            `;
            
            this.db.all(sql, [userId, date], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLocationCount(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM location_responses WHERE user_id = ? AND date = ?';
            
            this.db.get(sql, [userId, date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    async addPendingReminder(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO pending_reminders (user_id, date, reminder_count, last_reminder_time)
                VALUES (?, ?, 0, datetime('now'))
            `;
            
            this.db.run(sql, [userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateReminderCount(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE pending_reminders 
                SET reminder_count = reminder_count + 1, last_reminder_time = datetime('now')
                WHERE user_id = ? AND date = ?
            `;
            
            this.db.run(sql, [userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getPendingReminders(date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pr.*, u.teams_user_id, u.display_name 
                FROM pending_reminders pr
                JOIN users u ON pr.user_id = u.id
                WHERE pr.date = ? AND pr.reminder_count < 2
            `;
            
            this.db.all(sql, [date], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async removePendingReminder(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM pending_reminders WHERE user_id = ? AND date = ?';
            
            this.db.run(sql, [userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLocationStats(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.display_name,
                    u.employee_number,
                    lr.date,
                    lr.work_location,
                    lr.morning_location,
                    lr.afternoon_location,
                    lr.response_time,
                    COUNT(*) OVER (PARTITION BY lr.user_id, lr.date) as daily_updates
                FROM location_responses lr
                JOIN users u ON lr.user_id = u.id
                WHERE lr.date BETWEEN ? AND ?
                ORDER BY lr.date DESC, u.display_name, lr.response_time DESC
            `;
            
            this.db.all(sql, [startDate, endDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLatestLocationStats(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.display_name,
                    u.employee_number,
                    lr.date,
                    lr.work_location,
                    lr.morning_location,
                    lr.afternoon_location,
                    lr.response_time,
                    COUNT(*) OVER (PARTITION BY lr.user_id, lr.date) as daily_updates
                FROM location_responses lr
                JOIN users u ON lr.user_id = u.id
                WHERE lr.date BETWEEN ? AND ?
                AND lr.id IN (
                    SELECT id FROM location_responses lr2 
                    WHERE lr2.user_id = lr.user_id AND lr2.date = lr.date
                    ORDER BY lr2.response_time DESC LIMIT 1
                )
                ORDER BY lr.date DESC, u.display_name
            `;
            
            this.db.all(sql, [startDate, endDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getUserByDisplayName(displayName) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE LOWER(display_name) LIKE LOWER(?)';
            
            this.db.get(sql, [`%${displayName}%`], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async searchUsersByName(searchTerm) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE LOWER(display_name) LIKE LOWER(?) ORDER BY display_name';
            
            this.db.all(sql, [`%${searchTerm}%`], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getTeamCurrentLocations(date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT DISTINCT
                    u.display_name,
                    u.employee_number,
                    lr.work_location,
                    lr.morning_location,
                    lr.afternoon_location,
                    lr.response_time,
                    COUNT(*) OVER (PARTITION BY u.id) as daily_updates
                FROM users u
                LEFT JOIN location_responses lr ON u.id = lr.user_id 
                    AND lr.date = ?
                    AND lr.id = (
                        SELECT id FROM location_responses lr2 
                        WHERE lr2.user_id = u.id AND lr2.date = ?
                        ORDER BY lr2.response_time DESC LIMIT 1
                    )
                ORDER BY u.display_name
            `;
            
            this.db.all(sql, [date, date], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getUserCurrentLocation(userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.display_name,
                    u.employee_number,
                    lr.work_location,
                    lr.morning_location,
                    lr.afternoon_location,
                    lr.response_time,
                    COUNT(lr2.id) as daily_updates
                FROM users u
                LEFT JOIN location_responses lr ON u.id = lr.user_id 
                    AND lr.date = ?
                    AND lr.id = (
                        SELECT id FROM location_responses lr3 
                        WHERE lr3.user_id = u.id AND lr3.date = ?
                        ORDER BY lr3.response_time DESC LIMIT 1
                    )
                LEFT JOIN location_responses lr2 ON u.id = lr2.user_id AND lr2.date = ?
                WHERE u.id = ?
                GROUP BY u.id
            `;
            
            this.db.get(sql, [date, date, date, userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database; 