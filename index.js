const restify = require('restify');
const { BotFrameworkAdapter, MemoryStorage, ConversationState, UserState } = require('botbuilder');
const config = require('./config');
const LocationBot = require('./bot');
const LocationScheduler = require('./scheduler');

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(config.port, () => {
    console.log(`\n${server.name} listening on port ${config.port}`);
    console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
    console.log('\nTo test your bot in Teams, sideload the app manifest from: https://aka.ms/teams-app-studio');
});

// Create bot adapter
const adapter = new BotFrameworkAdapter({
    appId: config.microsoftAppId,
    appPassword: config.microsoftAppPassword
});

// Error handler
adapter.onTurnError = async (context, error) => {
    console.error('Bot adapter error:', error);
    await context.sendActivity('Sorry, an error occurred. Please try again later.');
};

// Create storage and conversation state
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

// Create the main dialog
const bot = new LocationBot();
let scheduler;

// Initialize bot and scheduler
async function initializeBot() {
    try {
        await bot.initialize();
        
        // Initialize scheduler with bot adapter and conversation references
        scheduler = new LocationScheduler(adapter, bot.getConversationReferences());
        await scheduler.initialize();
        
        console.log('✅ Location bot and scheduler initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize bot:', error);
        process.exit(1);
    }
}

// Main bot message handler
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// Health check endpoint
server.get('/health', (req, res) => {
    const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        scheduler: scheduler ? scheduler.getScheduleStatus() : 'not initialized'
    };
    
    res.json(healthStatus);
});

// Admin endpoints for testing (remove in production)
server.get('/admin/trigger-prompts', async (req, res) => {
    if (!scheduler) {
        return res.json({ error: 'Scheduler not initialized' });
    }
    
    try {
        await scheduler.triggerDailyPrompts();
        res.json({ message: 'Daily prompts triggered successfully' });
    } catch (error) {
        console.error('Error triggering prompts:', error);
        res.json({ error: 'Failed to trigger prompts' });
    }
});

server.get('/admin/trigger-reminders/:number', async (req, res) => {
    if (!scheduler) {
        return res.json({ error: 'Scheduler not initialized' });
    }
    
    const reminderNumber = parseInt(req.params.number) || 1;
    
    try {
        await scheduler.triggerReminders(reminderNumber);
        res.json({ message: `Reminder ${reminderNumber} triggered successfully` });
    } catch (error) {
        console.error('Error triggering reminders:', error);
        res.json({ error: 'Failed to trigger reminders' });
    }
});

// Get location statistics endpoint
server.get('/admin/stats', async (req, res) => {
    try {
        const startDate = req.query.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = req.query.end || new Date().toISOString().split('T')[0];
        const showAll = req.query.all === 'true'; // Query parameter to show all entries vs latest only
        
        let stats;
        if (showAll) {
            stats = await bot.database.getLocationStats(startDate, endDate);
        } else {
            stats = await bot.database.getLatestLocationStats(startDate, endDate);
        }
        
        res.json({
            dateRange: { startDate, endDate },
            showingAllEntries: showAll,
            totalResponses: stats.length,
            responses: stats.map(stat => ({
                ...stat,
                has_multiple_updates: stat.daily_updates > 1
            }))
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.json({ error: 'Failed to fetch statistics' });
    }
});

// Get detailed location history for a specific date
server.get('/admin/stats/detailed/:date', async (req, res) => {
    try {
        const date = req.params.date;
        const users = await bot.database.getAllUsers();
        const detailedStats = [];
        
        for (const user of users) {
            const history = await bot.database.getUserLocationHistory(user.id, date);
            if (history.length > 0) {
                detailedStats.push({
                    user: user.display_name,
                    employee_number: user.employee_number,
                    date: date,
                    total_updates: history.length,
                    location_history: history.map(entry => ({
                        time: entry.response_time,
                        location: entry.work_location,
                        morning_location: entry.morning_location,
                        afternoon_location: entry.afternoon_location
                    }))
                });
            }
        }
        
        res.json({
            date: date,
            users_with_responses: detailedStats.length,
            detailed_responses: detailedStats
        });
    } catch (error) {
        console.error('Error fetching detailed stats:', error);
        res.json({ error: 'Failed to fetch detailed statistics' });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    if (scheduler) {
        scheduler.stop();
    }
    
    if (bot) {
        bot.close();
    }
    
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    
    if (scheduler) {
        scheduler.stop();
    }
    
    if (bot) {
        bot.close();
    }
    
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Initialize the bot
initializeBot();

// Clean up pending responses every hour
setInterval(() => {
    if (bot) {
        bot.cleanupPendingResponses();
    }
}, 60 * 60 * 1000); // 1 hour

console.log('🚀 Location Bot starting...'); 