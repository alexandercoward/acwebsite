const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3007;

// --- Password-protected drafts ---
// Password: tWQ31nw0pGgTWh2JjU8Y
const DRAFTS_SALT = '4df566deb5a16f3c58541aa783e6f785';
const DRAFTS_HASH = '7c7727d166b28ba052f90bed6d33c0ddc1a07e7473d8d1e933daaef26a1e5b8693b097517cfb8c258a8bb96204dfc8928ba79a953ec766c45b8869061bf81715';
const COOKIE_SECRET = '4548182a2949a368fa7223bab464b19ff5b60d2990fce720067dd1c440975e2c';

function verifyPassword(password) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, DRAFTS_SALT, 64, (err, derivedKey) => {
      if (err) return reject(err);
      try {
        resolve(crypto.timingSafeEqual(derivedKey, Buffer.from(DRAFTS_HASH, 'hex')));
      } catch {
        resolve(false);
      }
    });
  });
}

function signToken(value) {
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex');
  return value + '.' + hmac;
}

function verifyToken(signed) {
  if (!signed || !signed.includes('.')) return false;
  const [value, sig] = signed.split('.');
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach(c => {
    const [key, ...rest] = c.trim().split('=');
    cookies[key] = rest.join('=');
  });
  return cookies;
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alexander Coward - Protected</title>
  <link rel="icon" type="image/png" href="/favicon.png" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .writingMainDiv {
      padding: 20px 35px;
      max-width: 700px;
      margin: auto;
    }
    h1 { margin-bottom: 20px; }
    .backLink { display: inline-block; margin-bottom: 20px; color: inherit; }
    .loginForm { margin-top: 20px; }
    .loginForm input[type="password"] {
      padding: 8px 12px;
      font-size: 16px;
      border: 1px solid #ccc;
      margin-right: 8px;
    }
    .loginForm button {
      padding: 8px 16px;
      font-size: 16px;
      cursor: pointer;
    }
    .error { color: #c00; margin-top: 10px; }
    p { margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="writingMainDiv">
    <a href="/" class="backLink">&larr; Home</a>
    <h1>Protected Content</h1>
    <p>This draft is password-protected. Please enter the password to continue.</p>
    <form class="loginForm" method="POST">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Enter</button>
    </form>
    ${error ? '<p class="error">' + error + '</p>' : ''}
  </div>
</body>
</html>`;
}

app.use(express.urlencoded({ extended: false }));

// Drafts routes (BEFORE static middleware)
app.get('/drafts/victory', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.drafts_auth && verifyToken(cookies.drafts_auth)) {
    return res.sendFile(path.join(__dirname, 'private', 'drafts-victory.html'));
  }
  res.send(loginPage());
});

app.post('/drafts/victory', async (req, res) => {
  const { password } = req.body;
  if (password && await verifyPassword(password)) {
    const token = signToken('authorized');
    res.setHeader('Set-Cookie', `drafts_auth=${token}; Path=/drafts; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return res.redirect('/drafts/victory');
  }
  res.send(loginPage('Incorrect password.'));
});

// Public essays
app.get('/essays/victory', (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'essays-victory.html'));
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
