const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.secret_key);
    const tenant_id = decoded;
    // Attach the 'tenant_uuid' to the request object for future use
    req.body.tenant_id = tenant_id;

    next();
  } catch (error) {
    return res.status(401).send({ error: 'Unauthorized: Invalid token' });
  }
}

module.exports = verifyToken;
