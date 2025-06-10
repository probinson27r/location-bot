require('dotenv').config();

module.exports = {
    // Microsoft Bot Framework
    microsoftAppId: process.env.MICROSOFT_APP_ID || '',
    microsoftAppPassword: process.env.MICROSOFT_APP_PASSWORD || '',
    
    // Server Configuration
    port: process.env.PORT || 3978,
    
    // Database
    databasePath: process.env.DATABASE_PATH || './data/locations.db',
    
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