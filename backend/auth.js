const express = require('express');
const crypto = require('crypto');

const COOKIE_NAME = 'admin_session';
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_TTL_HOURS = 24 * 7;
const LOCAL_ADMIN_USERNAME = 'nom';
const LOCAL_ADMIN_PASSWORD = 'mdp';
const LOCAL_ADMIN_AUTH_SECRET = 'shitstoire-local-admin-secret';

const attemptsByIp = new Map();

function base64urlEncode(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64urlDecode(input) {
    const normalized = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(input.length / 4) * 4, '=');
    return Buffer.from(normalized, 'base64').toString('utf8');
}

function hashPassword(password, salt) {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
    const [salt, expectedHash] = String(storedHash || '').split(':');
    if (!salt || !expectedHash) return false;

    const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(actualHash, 'hex');

    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
}

function sign(data, secret) {
    return base64urlEncode(
        crypto.createHmac('sha256', secret).update(data).digest(),
    );
}

function createSessionToken(username, secret, ttlSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: username,
        iat: now,
        exp: now + ttlSeconds,
    };

    const headerPart = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadPart = base64urlEncode(JSON.stringify(payload));
    const unsignedToken = `${headerPart}.${payloadPart}`;
    const signature = sign(unsignedToken, secret);
    return `${unsignedToken}.${signature}`;
}

function verifySessionToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerPart, payloadPart, signaturePart] = parts;
    const unsignedToken = `${headerPart}.${payloadPart}`;
    const expectedSignature = sign(unsignedToken, secret);

    if (expectedSignature.length !== signaturePart.length) return null;
    const a = Buffer.from(expectedSignature);
    const b = Buffer.from(signaturePart);
    if (!crypto.timingSafeEqual(a, b)) return null;

    try {
        const payload = JSON.parse(base64urlDecode(payloadPart));
        if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

function parseCookies(req) {
    const source = req.headers.cookie;
    if (!source) return {};

    return source.split(';').reduce((acc, part) => {
        const [rawKey, ...rest] = part.split('=');
        const key = rawKey && rawKey.trim();
        if (!key) return acc;

        acc[key] = decodeURIComponent(rest.join('=') || '');
        return acc;
    }, {});
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = attemptsByIp.get(ip);

    if (!record || now > record.resetAt) {
        attemptsByIp.set(ip, { count: 0, resetAt: now + LOGIN_WINDOW_MS });
        return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
    }

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
        return { blocked: true, retryInMs: record.resetAt - now };
    }

    return {
        blocked: false,
        remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - record.count),
    };
}

function markFailedAttempt(req) {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = attemptsByIp.get(ip);

    if (!record || now > record.resetAt) {
        attemptsByIp.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return;
    }

    record.count += 1;
    attemptsByIp.set(ip, record);
}

function clearFailedAttempts(req) {
    const ip = getClientIp(req);
    attemptsByIp.delete(ip);
}

function getAuthConfig() {
    const username = process.env.ADMIN_IDENTIFIANT
        || process.env.ADMIN_USERNAME
        || LOCAL_ADMIN_USERNAME;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    const passwordPlain = process.env.ADMIN_CODE
        || process.env.ADMIN_PASSWORD
        || LOCAL_ADMIN_PASSWORD;
    const authSecret = process.env.ADMIN_AUTH_SECRET
        || LOCAL_ADMIN_AUTH_SECRET;

    const ttlHours = Number(process.env.ADMIN_SESSION_TTL_HOURS || DEFAULT_TTL_HOURS);
    const ttlSeconds = Number.isFinite(ttlHours) && ttlHours > 0
        ? Math.floor(ttlHours * 3600)
        : DEFAULT_TTL_HOURS * 3600;

    const configured = Boolean(username && authSecret && (passwordHash || passwordPlain));

    return {
        configured,
        username,
        passwordHash,
        passwordPlain,
        authSecret,
        ttlSeconds,
        isLocalFallback: !process.env.ADMIN_IDENTIFIANT
            && !process.env.ADMIN_USERNAME
            && !process.env.ADMIN_PASSWORD_HASH
            && !process.env.ADMIN_CODE
            && !process.env.ADMIN_PASSWORD
            && !process.env.ADMIN_AUTH_SECRET,
    };
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    const cookies = parseCookies(req);
    return cookies[COOKIE_NAME] || null;
}

function requireAdmin(req, res, next) {
    const config = getAuthConfig();
    if (!config.configured) {
        return res.status(503).json({
            error: 'La sécurité admin n\'est pas configurée côté serveur.',
        });
    }

    const token = getTokenFromRequest(req);
    const payload = verifySessionToken(token, config.authSecret);

    if (!payload || payload.sub !== config.username) {
        return res.status(401).json({ error: 'Authentification requise.' });
    }

    req.adminUser = payload.sub;
    return next();
}

const adminRouter = express.Router();

adminRouter.get('/status', (req, res) => {
    const config = getAuthConfig();
    res.json({
        configured: config.configured,
        requires: [
            'ADMIN_IDENTIFIANT or ADMIN_USERNAME',
            'ADMIN_CODE or ADMIN_PASSWORD or ADMIN_PASSWORD_HASH',
            'ADMIN_AUTH_SECRET',
        ],
        localFallback: config.isLocalFallback,
    });
});

adminRouter.post('/login', (req, res) => {
    const config = getAuthConfig();
    if (!config.configured) {
        return res.status(503).json({
            error: 'Configurez ADMIN_USERNAME, ADMIN_PASSWORD_HASH et ADMIN_AUTH_SECRET.',
        });
    }

    const gate = checkRateLimit(req);
    if (gate.blocked) {
        return res.status(429).json({
            error: 'Trop de tentatives. Réessayez plus tard.',
            retryInMs: gate.retryInMs,
        });
    }

    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');

    const ok =
        username === config.username &&
        (config.passwordHash
            ? verifyPassword(password, config.passwordHash)
            : password === config.passwordPlain);

    if (!ok) {
        markFailedAttempt(req);
        return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    clearFailedAttempts(req);

    const token = createSessionToken(config.username, config.authSecret, config.ttlSeconds);
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: config.ttlSeconds * 1000,
        path: '/',
    });

    return res.json({ success: true });
});

adminRouter.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });

    res.json({ success: true });
});

adminRouter.get('/me', requireAdmin, (req, res) => {
    res.json({ authenticated: true, username: req.adminUser });
});

module.exports = {
    COOKIE_NAME,
    adminRouter,
    hashPassword,
    requireAdmin,
};
