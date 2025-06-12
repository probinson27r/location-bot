const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        status: 'ok', 
        message: 'Simple test server is running',
        timestamp: new Date().toISOString(),
        url: req.url,
        method: req.method
    }));
});

const port = process.env.PORT || 3978;

server.listen(port, () => {
    console.log(`Simple test server listening on port ${port}`);
    console.log('Environment: NODE_ENV =', process.env.NODE_ENV);
    console.log('Available at: http://localhost:' + port);
});

server.on('error', (error) => {
    console.error('Server error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
}); 