const sql = require('mssql');

class AzureDatabase {
    constructor() {
        this.pool = null;
        this.config = {
            server: process.env.AZURE_SQL_SERVER,
            database: process.env.AZURE_SQL_DATABASE,
            user: process.env.AZURE_SQL_USERNAME,
            password: process.env.AZURE_SQL_PASSWORD,
            port: 1433,
            options: {
                encrypt: true, // Azure SQL requires encryption
                trustServerCertificate: false
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            }
        };
    }

    async initialize() {
        try {
            console.log('🔌 Connecting to Azure SQL Database...');
            this.pool = await sql.connect(this.config);
            console.log('✅ Connected to Azure SQL Database');

            // Create tables if they don't exist
            await this.createTables();
            console.log('✅ Database tables verified/created');
        } catch (error) {
            console.error('❌ Error connecting to Azure SQL Database:', error);
            throw error;
        }
    }

    async createTables() {
        const transaction = new sql.Transaction(this.pool);
        
        try {
            await transaction.begin();

            // Create users table
            await transaction.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
                CREATE TABLE users (
                    id int IDENTITY(1,1) PRIMARY KEY,
                    tenant_id nvarchar(255) NOT NULL,
                    teams_user_id nvarchar(255) NOT NULL,
                    display_name nvarchar(255) NOT NULL,
                    employee_number nvarchar(50),
                    email nvarchar(255),
                    created_at datetime2 DEFAULT GETUTCDATE(),
                    updated_at datetime2 DEFAULT GETUTCDATE(),
                    CONSTRAINT unique_tenant_user UNIQUE (tenant_id, teams_user_id)
                );
            `);

            // Create location_responses table
            await transaction.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='location_responses' AND xtype='U')
                CREATE TABLE location_responses (
                    id int IDENTITY(1,1) PRIMARY KEY,
                    tenant_id nvarchar(255) NOT NULL,
                    user_id int NOT NULL,
                    date date NOT NULL,
                    work_location nvarchar(50),
                    morning_location nvarchar(50),
                    afternoon_location nvarchar(50),
                    response_time datetime2 DEFAULT GETUTCDATE(),
                    reminder_count int DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    INDEX idx_tenant_date (tenant_id, date),
                    INDEX idx_user_date (user_id, date)
                );
            `);

            // Create pending_reminders table
            await transaction.request().query(`
                IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pending_reminders' AND xtype='U')
                CREATE TABLE pending_reminders (
                    id int IDENTITY(1,1) PRIMARY KEY,
                    tenant_id nvarchar(255) NOT NULL,
                    user_id int NOT NULL,
                    date date NOT NULL,
                    reminder_count int DEFAULT 0,
                    created_at datetime2 DEFAULT GETUTCDATE(),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    INDEX idx_tenant_date (tenant_id, date)
                );
            `);

            await transaction.commit();
            console.log('✅ All tables created/verified successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error creating tables:', error);
            throw error;
        }
    }

    // Implement all the existing database methods with SQL Server syntax
    async insertOrUpdateUser(tenantId, teamsUserId, displayName, employeeNumber, email) {
        try {
            const request = this.pool.request()
                .input('tenantId', sql.NVarChar, tenantId)
                .input('teamsUserId', sql.NVarChar, teamsUserId)
                .input('displayName', sql.NVarChar, displayName)
                .input('employeeNumber', sql.NVarChar, employeeNumber || '')
                .input('email', sql.NVarChar, email || '');

            const result = await request.query(`
                MERGE users AS target
                USING (SELECT @tenantId as tenant_id, @teamsUserId as teams_user_id) AS source
                ON target.tenant_id = source.tenant_id AND target.teams_user_id = source.teams_user_id
                WHEN MATCHED THEN
                    UPDATE SET 
                        display_name = @displayName,
                        employee_number = @employeeNumber,
                        email = @email,
                        updated_at = GETUTCDATE()
                WHEN NOT MATCHED THEN
                    INSERT (tenant_id, teams_user_id, display_name, employee_number, email)
                    VALUES (@tenantId, @teamsUserId, @displayName, @employeeNumber, @email);
            `);

            return result;
        } catch (error) {
            console.error('Error inserting/updating user:', error);
            throw error;
        }
    }

    async getUserByTeamsId(tenantId, teamsUserId) {
        try {
            const request = this.pool.request()
                .input('tenantId', sql.NVarChar, tenantId)
                .input('teamsUserId', sql.NVarChar, teamsUserId);

            const result = await request.query(`
                SELECT * FROM users 
                WHERE tenant_id = @tenantId AND teams_user_id = @teamsUserId
            `);

            return result.recordset.length > 0 ? result.recordset[0] : null;
        } catch (error) {
            console.error('Error getting user by Teams ID:', error);
            throw error;
        }
    }

    // Add all other existing methods converted to SQL Server syntax...
    // (This is a simplified version - you'll need to convert all existing SQLite methods)

    close() {
        if (this.pool) {
            this.pool.close();
        }
    }
}

module.exports = AzureDatabase; 