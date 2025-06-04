// Simple development server for testing
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname); // 프로젝트 루트 디렉토리

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
    let filePath = path.join(ROOT_DIR, req.url === '/' ? '' : req.url);
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    console.log(`Attempting to serve: ${filePath}`);
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // src 디렉토리에서 파일 찾기 시도
                const srcFilePath = path.join(ROOT_DIR, 'src', req.url);
                console.log(`File not found. Trying src directory: ${srcFilePath}`);
                
                fs.readFile(srcFilePath, (srcError, srcContent) => {
                    if (srcError) {
                        res.writeHead(404);
                        res.end(`404 Not Found: ${req.url}`);
                        console.log(`404 Error: ${req.url} not found in root or src directory`);
                    } else {
                        const srcExtname = String(path.extname(srcFilePath)).toLowerCase();
                        const srcContentType = mimeTypes[srcExtname] || 'application/octet-stream';
                        res.writeHead(200, { 'Content-Type': srcContentType });
                        res.end(srcContent, 'utf-8');
                        console.log(`Served from src directory: ${req.url}`);
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`);
                console.error(`Server error: ${error.code} for ${req.url}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
            console.log(`Served from root directory: ${req.url}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Press Ctrl+C to stop the server');
});
