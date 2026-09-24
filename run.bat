@echo off
title PMTphim Server Deploy & Starter
echo ====================================================
echo PMTphim Server Deploy & Starter (Tu Dong Hoa)
echo ====================================================

:: Buoc 1: Chuyen vao thu muc cua file bat nay
cd /d "%~dp0"
echo [1/4] Chuyen vao thu muc du an: %cd%

:: Buoc 2: Build project
echo [2/4] Dang build frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build that bai! Vui long kiem tra code.
    pause
    exit /b
)

:: Buoc 3: Run backend API
echo [3/4] Dang khoi chay backend API...
:: Tat cac tien trinh PM2 cu neu co de tranh xung dot
call pm2 delete all >nul 2>nul
start "PMTphim API" npx tsx server/index.ts

:: Buoc 4: Cau hinh va khoi chay Nginx
echo [4/4] Dang cau hinh va khoi chay Nginx...

:: Tu dong tat Windows Firewall de thong port tu ngoai vao
echo Dang tu dong tat Windows Firewall...
powershell -Command "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False"

:: Tu dong tim thu muc Nginx
set "NGINX_DIR=C:\nginx-1.30.2\nginx-1.30.2"
if not exist "%NGINX_DIR%\nginx.exe" (
    set "NGINX_DIR=C:\nginx"
)

if not exist "%NGINX_DIR%\nginx.exe" (
    echo [ERROR] Khong tim thay thu muc Nginx! Vui long giai nen Nginx vao C:\nginx-1.30.2\nginx-1.30.2\ hoac C:\nginx.
    pause
    exit /b
)

echo Tim thay Nginx tai: %NGINX_DIR%

:: Ghi de file cau hinh Nginx tu dong de Nginx lang nghe tren toan bo cac port NAT kha thi
echo Dang tao file cau hinh conf/nginx.conf...
(
echo worker_processes  1;
echo events {
echo     worker_connections  1024;
echo }
echo http {
echo     include       mime.types;
echo     default_type  application/octet-stream;
echo     sendfile        on;
echo     keepalive_timeout  65;
echo     server {
echo         listen       20100;
echo         listen       20101;
echo         listen       20102;
echo         listen       20103;
echo         listen       20104;
echo         listen       20105;
echo         listen       20106;
echo         listen       20107;
echo         listen       20108;
echo         listen       20109;
echo         listen       20110;
echo         listen       20111;
echo         listen       20112;
echo         listen       20113;
echo         listen       20114;
echo         listen       20115;
echo         listen       20116;
echo         listen       20117;
echo         listen       20118;
echo         listen       20119;
echo         listen       20120;
echo         listen       20121;
echo         listen       20122;
echo         listen       20123;
echo         listen       20124;
echo         listen       20125;
echo         listen       20126;
echo         listen       20127;
echo         listen       20128;
echo         listen       20129;
echo         listen       20130;
echo         listen       20131;
echo         listen       20132;
echo         listen       20133;
echo         listen       20134;
echo         listen       20135;
echo         listen       20136;
echo         listen       20137;
echo         listen       20138;
echo         listen       20139;
echo         listen       20140;
echo         server_name  localhost;
echo         location / {
echo             root   C:/Web_truyen/dist;
echo             index  index.html;
echo             try_files $uri $uri/ /index.html;
echo         }
echo         location /api {
echo             proxy_pass http://127.0.0.1:3001;
echo             proxy_http_version 1.1;
echo             proxy_set_header Upgrade $http_upgrade;
echo             proxy_set_header Connection 'upgrade';
echo             proxy_set_header Host $host;
echo             proxy_cache_bypass $http_upgrade;
echo         }
echo         location /uploads {
echo             alias C:/Web_truyen/uploads;
echo         }
echo         location /sample {
echo             alias C:/Web_truyen/public/sample;
echo         }
echo     }
echo }
) > "%NGINX_DIR%\conf\nginx.conf"

:: Khoi dong lai Nginx
cd /d "%NGINX_DIR%"
echo Dang khoi dong lai Nginx...
taskkill /f /im nginx.exe >nul 2>nul
nginx -s stop >nul 2>nul
start nginx

echo ====================================================
echo PMTphim da duoc khoi chay thanh cong!
echo Windows Firewall da duoc tu dong tat de thong port.
echo Nginx dang lang nghe tren toan bo dai port tu 20100 den 20140.
echo ====================================================
pause
