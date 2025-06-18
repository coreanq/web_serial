// Simple development server for testing
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname, 'src'); // Set ROOT_DIR to src folder

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // URL에서 쿼리 파라미터 제거
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    let cleanPath = urlObj.pathname;
    
    if (cleanPath === '/') {
        cleanPath = '/index.html';
    }

    let filePath = path.join(ROOT_DIR, cleanPath);
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    console.log(`Attempting to serve: ${filePath}`);
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end(`404 Not Found: ${req.url}`);
                console.log(`404 Error: ${req.url} not found`);
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
                console.error(`Server error: ${error.code} for ${req.url}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
            console.log(`Served: ${req.url}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server');
});
