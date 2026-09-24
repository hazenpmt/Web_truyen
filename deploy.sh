#!/bin/bash
# PMTphim Server Deploy Script for Ubuntu 22.04
# Script nay se tu dong thiet lap moi truong tu A-Z va chay Web o cong 80.

echo "===================================================="
echo "Bat dau thiet lap moi truong va trien khai PMTphim..."
echo "===================================================="

# Buoc 1: Cap nhat he thong va cai dat cac cong cu can thiet
echo "[1/7] Cap nhat he thong va tai cac thu vien can thiet..."
sudo apt-get update -y
sudo apt-get install -y curl rsync build-essential

# Buoc 2: Cai dat Node.js v20 (phien ban moi on dinh)
echo "[2/7] Dang cai dat Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Kiem tra phien ban Node.js va NPM
node -v
npm -v

# Buoc 3: Cai dat PM2 va Nginx
echo "[3/7] Cai dat PM2 (quan ly API chay ngam) va Nginx (Web Server)..."
sudo npm install -g pm2
sudo apt-get install -y nginx

# Buoc 4: Sao chep du an vao thu muc he thong /var/www/
echo "[4/7] Chuyen ma nguon vao thu muc chay web he thong..."
sudo mkdir -p /var/www/Web_truyen
# Dong bo code tu thu muc hien tai, bo qua du lieu song tren VPS.
# KHONG dong bo data/. Day la noi giu tai khoan, binh luan, lich su, cache phim/truyen.
sudo rsync -av --delete \
  --exclude='data/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='public/uploads/' \
  --exclude='server.log' \
  --exclude='server.err.log' \
  --exclude='*.before-reader-update' \
  --exclude='*.corrupt-backup' \
  --exclude='test_*.js' \
  --exclude='inspect_*.js' \
  --exclude='tool_crawl.txt' \
  ./ /var/www/Web_truyen/

sudo mkdir -p /var/www/Web_truyen/data /var/www/Web_truyen/public/uploads

# Phan quyen quyen truy cap cho thu muc
sudo chown -R www-data:www-data /var/www/Web_truyen
sudo chmod -R 775 /var/www/Web_truyen

# Buoc 5: Tai thu vien Node.js va Build du an
echo "[5/7] Cài dat thu vien NPM va Build code Frontend..."
cd /var/www/Web_truyen
sudo npm install
sudo npm run build

# Buoc 6: Cau hinh Nginx o cong 80 (IP rieng)
echo "[6/7] Dang cau hinh Web Server Nginx (Cong 80)..."
cat << 'EOF' | sudo tee /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/Web_truyen/dist;
    index index.html;

    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/Web_truyen/uploads;
    }

    location /sample {
        alias /var/www/Web_truyen/public/sample;
    }
}
EOF

# Restart Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Buoc 7: Khoi chay Backend API bang PM2
echo "[7/7] Khoi chay Backend API Node.js..."
# Xoa cac dich vu PM2 cu neu co de lam sach
sudo pm2 delete web-truyen >/dev/null 2>&1
sudo pm2 delete pmtphim-api >/dev/null 2>&1
# Khoi dong lai bang ban build de tiet kiem RAM/CPU tren VPS nho.
# TruyenQQ auto-sync chi crawl cac trang moi cap nhat moi gio, khong crawl full lai.
sudo env \
  NODE_ENV=production \
  ENABLE_TRUYENQQ_AUTO_SYNC=1 \
  TRUYENQQ_INITIAL_SYNC_PAGES=3 \
  TRUYENQQ_INTERVAL_SYNC_PAGES=3 \
  pm2 start dist-server/index.js --name "web-truyen" --time
sudo pm2 save
# Thiet lap tu dong khoi dong API khi VPS bi reboot
sudo pm2 startup

echo "===================================================="
echo "PMTphim da duoc trien khai thanh cong!"
echo "Hay mo trinh duyet va truy cap IP cua VPS de kiem tra!"
echo "===================================================="
