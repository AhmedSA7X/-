const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    } else if (filePath === './join') {
        filePath = './join.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 الصفحة غير موجودة</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('خطأ في السيرفر: '+error.code+' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

}).listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 السيرفر اللوكال يعمل بنجاح!`);
    console.log(`💻 لشاشة الهوست (من نفس الكمبيوتر): http://localhost:${PORT}`);
    console.log(`📱 لدخول اللاعبين (من جوالاتهم عبر شبكة الواي فاي):`);
    console.log(`   اطلب منهم كتابة هذا الرابط في المتصفح:`);
    console.log(`   http://<الأيبي-الداخلي-لجهازك>:${PORT}/join.html`);
    console.log(`\n💡 ملاحظة: نظام اللعبة (الجرس والاتصال) يعتمد الآن على Firebase وسيعمل أونلاين بكفاءة دون الحاجة لـ Socket.io!`);
    console.log(`=======================================================`);
});
