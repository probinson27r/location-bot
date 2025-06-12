const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    
    res.end(JSON.stringify({ 
        status: 'success',
        message: 'Ultra simple server is running!',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || 'development'
    }));
});

const port = process.env.PORT || 8080;

server.listen(port, '0.0.0.0', () => {
    console.log(`Ultra simple server started successfully on port ${port}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

console.log('Ultra simple server script loaded'); 