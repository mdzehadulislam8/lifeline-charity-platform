// ====================================
// AUTHENTICATION MIDDLEWARE
// ====================================

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        req.user = decoded;
        next();

    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function optionalAuthenticate(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            // No token provided — proceed as anonymous
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        req.user = decoded;
        next();
    } catch (error) {
        // Token invalid — treat as anonymous (do not block)
        req.user = null;
        next();
    }
}

function adminOnly(req, res, next) {
    if (req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

function doctorOnly(req, res, next) {
    if (req.user.userType !== 'doctor') {
        return res.status(403).json({ message: 'Doctor access required' });
    }
    next();
}

module.exports = { authenticate, adminOnly, doctorOnly, optionalAuthenticate };
