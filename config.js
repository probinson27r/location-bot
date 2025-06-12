require('dotenv').config();

module.exports = {
    // Microsoft Bot Framework
    microsoftAppId: process.env.MICROSOFT_APP_ID || '',
    microsoftAppPassword: process.env.MICROSOFT_APP_PASSWORD || '',
    
    // Server Configuration
    port: process.env.PORT || 3978,
    
    // Environment
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database Configuration
    database: {
        // SQLite for development
        sqlite: {
            path: process.env.DATABASE_PATH || './data/locations.db'
        },
        // Azure SQL for production
        azure: {
            server: process.env.AZURE_SQL_SERVER,
            database: process.env.AZURE_SQL_DATABASE,
            user: process.env.AZURE_SQL_USERNAME,
            password: process.env.AZURE_SQL_PASSWORD,
            options: {
                encrypt: true,
                enableArithAbort: true,
                connectTimeout: 30000,
                requestTimeout: 30000
            }
        }
    },
    
    // Timezone
    timezone: process.env.TIMEZONE || 'Australia/Perth',
    
    // Schedule times
    schedules: {
        dailyPrompt: '00 09 * * 1-5', // 9:00 AM Monday-Friday
        firstReminder: '30 09 * * 1-5', // 9:30 AM Monday-Friday
        secondReminder: '00 10 * * 1-5', // 10:00 AM Monday-Friday
        dailyReset: '59 23 * * 1-5' // 11:59 PM Monday-Friday
    },
    
    // Work location options
    workLocations: {
        REMOTE: 'Remote',
        OFFICE: 'Office'
    },
    
    // Holiday API
    holidayApiKey: process.env.HOLIDAY_API_KEY || ''
}; 