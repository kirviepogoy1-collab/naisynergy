const net = require('net');

const normalizeIp = (ip) => {
    if (!ip || typeof ip !== 'string') return '';
    if (ip.startsWith('::ffff:')) {
        return ip.slice(7);
    }
    return ip;
};

const ipToNumber = (ip) => {
    if (net.isIP(ip) !== 4) return null;
    return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
};

const parseRange = (entry) => {
    if (!entry) return null;
    const trimmed = entry.trim();
    if (!trimmed) return null;

    if (trimmed.includes('/')) {
        const [ip, prefix] = trimmed.split('/');
        const maskLength = Number(prefix);
        if (net.isIP(ip) !== 4 || maskLength < 0 || maskLength > 32) return null;

        const ipNum = ipToNumber(ip);
        const mask = maskLength === 0 ? 0 : ~((1 << (32 - maskLength)) - 1) >>> 0;
        return {
            start: ipNum & mask,
            end: (ipNum & mask) | (~mask >>> 0),
        };
    }

    if (net.isIP(trimmed) !== 4) return null;
    const ipNum = ipToNumber(trimmed);
    return { start: ipNum, end: ipNum };
};

const loadAllowedRanges = () => {
    const raw = process.env.ALLOWED_IPS || '';
    return raw
        .split(',')
        .map(parseRange)
        .filter(Boolean);
};

const isIpAllowed = (ip, ranges) => {
    if (!ip || ranges.length === 0) return true;
    if (ip === '::1') {
        return ranges.some((range) => range.start <= ipToNumber('127.0.0.1') && ipToNumber('127.0.0.1') <= range.end);
    }

    const normalizedIp = normalizeIp(ip);
    const ipNum = ipToNumber(normalizedIp);
    if (ipNum === null) return false;

    return ranges.some((range) => ipNum >= range.start && ipNum <= range.end);
};

const allowedRanges = loadAllowedRanges();

function ipFirewall(req, res, next) {
    if (allowedRanges.length === 0) {
        return next();
    }

    const clientIp = req.ip || req.connection.remoteAddress;
    if (!isIpAllowed(clientIp, allowedRanges)) {
        console.warn(`Blocked request from IP ${clientIp}`);
        return res.status(403).json({ error: 'Access denied from this IP address.' });
    }

    next();
}

module.exports = ipFirewall;
