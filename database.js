const path = require('path');
const fs = require('fs');
const config = require('./config');

class Database {
    constructor() {
        this.isProduction = config.nodeEnv === 'production';
        this.db = null;
        
        if (this.isProduction) {
            // Use Azure SQL for production
            const sql = require('mssql');
            this.sql = sql;
            this.config = config.database.azure;
            console.log('🌐 Database: Using Azure SQL Database for production');
        } else {
            // Use SQLite for development (optional dependency)
            try {
                const sqlite3 = require('sqlite3').verbose();
                this.sqlite3 = sqlite3;
                this.dbPath = config.database.sqlite.path;
                this.ensureDataDirectory();
                console.log('💾 Database: Using SQLite for development');
            } catch (err) {
                console.error('❌ SQLite not available - falling back to Azure SQL');
                console.log('🌐 Database: Using Azure SQL Database (fallback)');
                this.isProduction = true;
                const sql = require('mssql');
                this.sql = sql;
                this.config = config.database.azure;
            }
        }
    }

    ensureDataDirectory() {
        if (!this.isProduction && this.dbPath) {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    async initialize() {
        if (this.isProduction) {
            return this.initializeAzureSQL();
        } else {
            return this.initializeSQLite();
        }
    }

    async initializeAzureSQL() {
        try {
            this.pool = await this.sql.connect(this.config);
            console.log('Connected to Azure SQL Database');
            await this.createTablesAzure();
            return true;
        } catch (err) {
            console.error('Error connecting to Azure SQL Database:', err);
            throw err;
        }
    }

    async initializeSQLite() {
        return new Promise((resolve, reject) => {
            this.db = new this.sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTablesSQLite().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTablesAzure() {
        try {
            // Create users table
            await this.pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
                BEGIN
                    CREATE TABLE users (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        tenant_id NVARCHAR(100) NOT NULL,
                        teams_user_id NVARCHAR(200) NOT NULL,
                        display_name NVARCHAR(200) NOT NULL,
                        employee_number NVARCHAR(50),
                        email NVARCHAR(200),
                        created_at DATETIME2 DEFAULT GETDATE()
                    );
                    
                    CREATE UNIQUE INDEX idx_users_unique ON users (tenant_id, teams_user_id);
                END
            `);

            // Create location_responses table
            await this.pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='location_responses' AND xtype='U')
                BEGIN
                    CREATE TABLE location_responses (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        tenant_id NVARCHAR(100) NOT NULL,
                        user_id INT NOT NULL,
                        date DATE NOT NULL,
                        response_time DATETIME2 NOT NULL,
                        work_location NVARCHAR(50) NOT NULL,
                        morning_location NVARCHAR(50),
                        afternoon_location NVARCHAR(50),
                        reminder_count INT DEFAULT 0,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    );
                END
            `);

            // Create pending_reminders table
            await this.pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pending_reminders' AND xtype='U')
                BEGIN
                    CREATE TABLE pending_reminders (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        tenant_id NVARCHAR(100) NOT NULL,
                        user_id INT NOT NULL,
                        date DATE NOT NULL,
                        reminder_count INT DEFAULT 0,
                        last_reminder_time DATETIME2,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    );
                    
                    CREATE UNIQUE INDEX idx_pending_reminders_unique ON pending_reminders (tenant_id, user_id, date);
                END
            `);

            // Create performance indices
            await this.pool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_users_tenant_teams_id' AND object_id = OBJECT_ID('users'))
                    CREATE INDEX idx_users_tenant_teams_id ON users (tenant_id, teams_user_id);
                
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_location_responses_tenant_user_date' AND object_id = OBJECT_ID('location_responses'))
                    CREATE INDEX idx_location_responses_tenant_user_date ON location_responses (tenant_id, user_id, date);
                
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_pending_reminders_tenant_date' AND object_id = OBJECT_ID('pending_reminders'))
                    CREATE INDEX idx_pending_reminders_tenant_date ON pending_reminders (tenant_id, date);
            `);

            console.log('Database tables created successfully');
        } catch (err) {
            console.error('Error creating tables:', err);
            throw err;
        }
    }

    async createTablesSQLite() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id TEXT NOT NULL,
                    teams_user_id TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    employee_number TEXT,
                    email TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(tenant_id, teams_user_id)
                );

                CREATE TABLE IF NOT EXISTS location_responses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tenant_id TEXT NOT NULL,
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
                    tenant_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    date DATE NOT NULL,
                    reminder_count INTEGER DEFAULT 0,
                    last_reminder_time DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(tenant_id, user_id, date)
                );

                -- Create indices for better performance with tenant filtering
                CREATE INDEX IF NOT EXISTS idx_users_tenant_teams_id ON users (tenant_id, teams_user_id);
                CREATE INDEX IF NOT EXISTS idx_location_responses_tenant_user_date ON location_responses (tenant_id, user_id, date);
                CREATE INDEX IF NOT EXISTS idx_pending_reminders_tenant_date ON pending_reminders (tenant_id, date);
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

    async insertOrUpdateUser(tenantId, teamsUserId, displayName, employeeNumber, email) {
        if (this.isProduction) {
            const request = this.pool.request();
            request.input('tenantId', this.sql.NVarChar, tenantId);
            request.input('teamsUserId', this.sql.NVarChar, teamsUserId);
            request.input('displayName', this.sql.NVarChar, displayName);
            request.input('employeeNumber', this.sql.NVarChar, employeeNumber);
            request.input('email', this.sql.NVarChar, email);
            
            const result = await request.query(`
                MERGE users AS target
                USING (SELECT @tenantId AS tenant_id, @teamsUserId AS teams_user_id) AS source
                ON target.tenant_id = source.tenant_id AND target.teams_user_id = source.teams_user_id
                WHEN MATCHED THEN
                    UPDATE SET display_name = @displayName, employee_number = @employeeNumber, email = @email
                WHEN NOT MATCHED THEN
                    INSERT (tenant_id, teams_user_id, display_name, employee_number, email)
                    VALUES (@tenantId, @teamsUserId, @displayName, @employeeNumber, @email);
                SELECT @@IDENTITY AS id;
            `);
            
            return result.recordset[0]?.id;
        } else {
            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT OR REPLACE INTO users (tenant_id, teams_user_id, display_name, employee_number, email)
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                this.db.run(sql, [tenantId, teamsUserId, displayName, employeeNumber, email], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        }
    }

    async getUserByTeamsId(tenantId, teamsUserId) {
        if (this.isProduction) {
            const request = this.pool.request();
            request.input('tenantId', this.sql.NVarChar, tenantId);
            request.input('teamsUserId', this.sql.NVarChar, teamsUserId);
            
            const result = await request.query('SELECT * FROM users WHERE tenant_id = @tenantId AND teams_user_id = @teamsUserId');
            return result.recordset[0];
        } else {
            return new Promise((resolve, reject) => {
                const sql = 'SELECT * FROM users WHERE tenant_id = ? AND teams_user_id = ?';
                
                this.db.get(sql, [tenantId, teamsUserId], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        }
    }

    async saveLocationResponse(tenantId, userId, date, workLocation, morningLocation = null, afternoonLocation = null, reminderCount = 0) {
        if (this.isProduction) {
            const request = this.pool.request();
            request.input('tenantId', this.sql.NVarChar, tenantId);
            request.input('userId', this.sql.Int, userId);
            request.input('date', this.sql.Date, date);
            request.input('workLocation', this.sql.NVarChar, workLocation);
            request.input('morningLocation', this.sql.NVarChar, morningLocation);
            request.input('afternoonLocation', this.sql.NVarChar, afternoonLocation);
            request.input('reminderCount', this.sql.Int, reminderCount);
            
            const result = await request.query(`
                INSERT INTO location_responses 
                (tenant_id, user_id, date, response_time, work_location, morning_location, afternoon_location, reminder_count)
                VALUES (@tenantId, @userId, @date, GETDATE(), @workLocation, @morningLocation, @afternoonLocation, @reminderCount);
                SELECT @@IDENTITY AS id;
            `);
            
            return result.recordset[0]?.id;
        } else {
            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO location_responses 
                    (tenant_id, user_id, date, response_time, work_location, morning_location, afternoon_location, reminder_count)
                    VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
                `;
                
                this.db.run(sql, [tenantId, userId, date, workLocation, morningLocation, afternoonLocation, reminderCount], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        }
    }

    async hasUserRespondedToday(tenantId, userId, date) {
        if (this.isProduction) {
            const request = this.pool.request();
            request.input('tenantId', this.sql.NVarChar, tenantId);
            request.input('userId', this.sql.Int, userId);
            request.input('date', this.sql.Date, date);
            
            const result = await request.query('SELECT COUNT(*) as count FROM location_responses WHERE tenant_id = @tenantId AND user_id = @userId AND date = @date');
            return result.recordset[0].count > 0;
        } else {
            return new Promise((resolve, reject) => {
                const sql = 'SELECT COUNT(*) as count FROM location_responses WHERE tenant_id = ? AND user_id = ? AND date = ?';
                
                this.db.get(sql, [tenantId, userId, date], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row.count > 0);
                    }
                });
            });
        }
    }

    async getLatestLocationForUser(tenantId, userId, date) {
        if (this.isProduction) {
            const request = this.pool.request();
            request.input('tenantId', this.sql.NVarChar, tenantId);
            request.input('userId', this.sql.Int, userId);
            request.input('date', this.sql.Date, date);
            
            const result = await request.query(`
                SELECT TOP 1 * FROM location_responses 
                WHERE tenant_id = @tenantId AND user_id = @userId AND date = @date 
                ORDER BY response_time DESC
            `);
            return result.recordset[0];
        } else {
            return new Promise((resolve, reject) => {
                const sql = `
                    SELECT * FROM location_responses 
                    WHERE tenant_id = ? AND user_id = ? AND date = ? 
                    ORDER BY response_time DESC 
                    LIMIT 1
                `;
                
                this.db.get(sql, [tenantId, userId, date], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        }
    }

    async getUserLocationHistory(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM location_responses 
                WHERE tenant_id = ? AND user_id = ? AND date = ? 
                ORDER BY response_time ASC
            `;
            
            this.db.all(sql, [tenantId, userId, date], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLocationCount(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM location_responses WHERE tenant_id = ? AND user_id = ? AND date = ?';
            
            this.db.get(sql, [tenantId, userId, date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    async addPendingReminder(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO pending_reminders (tenant_id, user_id, date, reminder_count, last_reminder_time)
                VALUES (?, ?, ?, 0, datetime('now'))
            `;
            
            this.db.run(sql, [tenantId, userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async updateReminderCount(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE pending_reminders 
                SET reminder_count = reminder_count + 1, last_reminder_time = datetime('now')
                WHERE tenant_id = ? AND user_id = ? AND date = ?
            `;
            
            this.db.run(sql, [tenantId, userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getPendingReminders(tenantId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pr.*, u.teams_user_id, u.display_name 
                FROM pending_reminders pr
                JOIN users u ON pr.user_id = u.id
                WHERE pr.tenant_id = ? AND pr.date = ? AND pr.reminder_count < 2
            `;
            
            this.db.all(sql, [tenantId, date], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async removePendingReminder(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM pending_reminders WHERE tenant_id = ? AND user_id = ? AND date = ?';
            
            this.db.run(sql, [tenantId, userId, date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getAllUsers(tenantId) {
        return new Promise((resolve, reject) => {
            let sql, params;
            
            if (tenantId && tenantId !== '') {
                // Get users for specific tenant
                sql = 'SELECT * FROM users WHERE tenant_id = ?';
                params = [tenantId];
            } else {
                // Get all users across all tenants (for scheduler operations)
                sql = 'SELECT * FROM users';
                params = [];
            }
            
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLocationStats(tenantId, startDate, endDate) {
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
                    COUNT(*) OVER (PARTITION BY lr.user_id, lr.date) as daily_updates,
                    ROW_NUMBER() OVER (PARTITION BY lr.user_id, lr.date ORDER BY lr.response_time DESC) as update_count
                FROM location_responses lr
                JOIN users u ON lr.user_id = u.id
                WHERE lr.tenant_id = ? AND lr.date BETWEEN ? AND ?
                ORDER BY lr.date DESC, u.display_name, lr.response_time DESC
            `;
            
            this.db.all(sql, [tenantId, startDate, endDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getLatestLocationStats(tenantId, startDate, endDate) {
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
                WHERE lr.tenant_id = ? AND lr.date BETWEEN ? AND ?
                    AND lr.id IN (
                        SELECT id FROM location_responses lr2 
                        WHERE lr2.user_id = lr.user_id AND lr2.tenant_id = lr.tenant_id AND lr2.date = lr.date
                        ORDER BY lr2.response_time DESC LIMIT 1
                    )
                ORDER BY lr.date DESC, u.display_name
            `;
            
            this.db.all(sql, [tenantId, startDate, endDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getUserByDisplayName(tenantId, displayName) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE tenant_id = ? AND display_name = ?';
            
            this.db.get(sql, [tenantId, displayName], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async searchUsersByName(tenantId, searchTerm) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE tenant_id = ? AND display_name LIKE ?';
            const searchPattern = `%${searchTerm}%`;
            
            this.db.all(sql, [tenantId, searchPattern], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getTeamCurrentLocations(tenantId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.id,
                    u.display_name,
                    u.employee_number,
                    lr.work_location,
                    lr.response_time,
                    COUNT(*) OVER (PARTITION BY u.id) as daily_updates
                FROM users u
                LEFT JOIN (
                    SELECT 
                        user_id,
                        work_location,
                        response_time,
                        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY response_time DESC) as rn
                    FROM location_responses 
                    WHERE tenant_id = ? AND date = ?
                ) lr ON u.id = lr.user_id AND lr.rn = 1
                WHERE u.tenant_id = ?
                ORDER BY u.display_name
            `;
            
            this.db.all(sql, [tenantId, date, tenantId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getUserCurrentLocation(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    u.display_name,
                    u.employee_number,
                    lr.work_location,
                    lr.response_time,
                    lr.morning_location,
                    lr.afternoon_location,
                    COUNT(lr2.id) as daily_updates
                FROM users u
                LEFT JOIN location_responses lr ON u.id = lr.user_id AND lr.tenant_id = ? AND lr.date = ?
                LEFT JOIN location_responses lr2 ON u.id = lr2.user_id AND lr2.tenant_id = ? AND lr2.date = ?
                WHERE u.tenant_id = ? AND u.id = ?
                AND (lr.id IS NULL OR lr.response_time = (
                    SELECT MAX(response_time) 
                    FROM location_responses 
                    WHERE user_id = u.id AND tenant_id = ? AND date = ?
                ))
                GROUP BY u.id, lr.id
            `;
            
            this.db.get(sql, [tenantId, date, tenantId, date, tenantId, userId, tenantId, date], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Clear all pending reminders for a specific date and tenant (daily reset)
     */
    async clearAllPendingReminders(tenantId, date) {
        return new Promise((resolve, reject) => {
            console.log(`🗄️ Database: Clearing all pending reminders for tenant ${tenantId} on date: ${date}`);
            
            const sql = `DELETE FROM pending_reminders WHERE tenant_id = ? AND date = ?`;
            
            this.db.run(sql, [tenantId, date], function(err) {
                if (err) {
                    console.error('Error clearing pending reminders:', err);
                    reject(err);
                } else {
                    console.log(`🗄️ Database: Cleared ${this.changes} pending reminders for ${tenantId} on ${date}`);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Get daily statistics for end-of-day summary (tenant-specific)
     */
    async getDailyStatistics(tenantId, date) {
        return new Promise((resolve, reject) => {
            console.log(`🗄️ Database: Getting daily statistics for tenant ${tenantId} on: ${date}`);
            
            const sql = `
                SELECT 
                    COUNT(DISTINCT u.id) as total_users,
                    COUNT(DISTINCT lr.user_id) as responded_users,
                    COUNT(DISTINCT CASE WHEN lr.work_location = 'Remote' THEN lr.user_id END) as remote_users,
                    COUNT(DISTINCT CASE WHEN lr.work_location = 'Office' THEN lr.user_id END) as office_users,
                    (SELECT COUNT(*) FROM location_responses WHERE tenant_id = ? AND date = ?) as total_updates
                FROM users u
                LEFT JOIN location_responses lr ON u.id = lr.user_id AND lr.tenant_id = ? AND lr.date = ?
                WHERE u.tenant_id = ?
            `;
            
            this.db.get(sql, [tenantId, date, tenantId, date, tenantId], (err, row) => {
                if (err) {
                    console.error('Error getting daily statistics:', err);
                    reject(err);
                } else {
                    console.log(`🗄️ Database: Daily stats for tenant ${tenantId} - ${row.responded_users}/${row.total_users} users responded`);
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get users who didn't respond today (for end-of-day summary, tenant-specific)
     */
    async getUsersWhoDidntRespond(tenantId, date) {
        return new Promise((resolve, reject) => {
            console.log(`🗄️ Database: Getting users who didn't respond for tenant ${tenantId} on: ${date}`);
            
            const sql = `
                SELECT u.id, u.teams_user_id, u.display_name, u.employee_number
                FROM users u
                LEFT JOIN location_responses lr ON u.id = lr.user_id AND lr.tenant_id = ? AND lr.date = ?
                WHERE u.tenant_id = ? AND lr.user_id IS NULL
                ORDER BY u.display_name
            `;
            
            this.db.all(sql, [tenantId, date, tenantId], (err, rows) => {
                if (err) {
                    console.error('Error getting non-responding users:', err);
                    reject(err);
                } else {
                    console.log(`🗄️ Database: Found ${rows.length} users who didn't respond for tenant ${tenantId} on ${date}`);
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Clear user's location for a specific date (set to not working)
     */
    async clearUserLocation(tenantId, userId, date) {
        return new Promise((resolve, reject) => {
            console.log(`🗑️ Database: Clearing location for user ${userId} on date: ${date}`);
            const sql = 'DELETE FROM location_responses WHERE tenant_id = ? AND user_id = ? AND date = ?';
            
            this.db.run(sql, [tenantId, userId, date], function(err) {
                if (err) {
                    console.error('🗑️ Database: Error clearing location:', err);
                    reject(err);
                } else {
                    console.log(`🗑️ Database: Cleared ${this.changes} location entries for user ${userId} on ${date}`);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Clean up old pending reminders (older than specified date)
     */
    async cleanupOldPendingReminders(cutoffDate) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM pending_reminders WHERE date < ?';
            
            this.db.run(sql, [cutoffDate], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes); // Returns number of rows deleted
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