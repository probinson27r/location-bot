const restify = require('restify');
console.log('✓ Restify loaded successfully');

try {
    const { BotFrameworkAdapter } = require('botbuilder');
    console.log('✓ BotFrameworkAdapter loaded successfully');
} catch (error) {
    console.error('✗ Failed to load BotFrameworkAdapter:', error.message);
    console.error('Stack:', error.stack);
}

try {
    const config = require('./config');
    console.log('✓ Config loaded successfully');
    console.log('Config NODE_ENV:', config.nodeEnv);
    console.log('Config PORT:', config.port);
} catch (error) {
    console.error('✗ Failed to load config:', error.message);
    console.error('Stack:', error.stack);
}

// Test database connection
try {
    const DatabaseManager = require('./database');
    console.log('✓ DatabaseManager loaded successfully');
    
    async function testDatabase() {
        try {
            const db = new DatabaseManager();
            await db.initialize();
            console.log('✓ Database connection successful');
        } catch (error) {
            console.error('✗ Database connection failed:', error.message);
            console.error('Stack:', error.stack);
        }
    }
    
    testDatabase();
} catch (error) {
    console.error('✗ Failed to load DatabaseManager:', error.message);
    console.error('Stack:', error.stack);
}

// Create minimal server
const server = restify.createServer();
server.get('/test', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 3978;
server.listen(port, () => {
    console.log(`✓ Minimal test server listening on port ${port}`);
    console.log('Test endpoint available at /test');
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}); 