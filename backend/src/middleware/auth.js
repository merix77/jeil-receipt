function requireApiKey(req, res, next) {
  const key = req.header('x-api-key');

  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  next();
}

module.exports = requireApiKey;
