function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-fx-token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function extractToken(req) {
  if (req.query && req.query.token) {
    return String(req.query.token).trim().toUpperCase();
  }
  if (req.body && req.body.token) {
    return String(req.body.token).trim().toUpperCase();
  }
  if (req.body && req.body.ownerToken) {
    return String(req.body.ownerToken).trim().toUpperCase();
  }
  const headerToken = req.headers["x-fx-token"];
  if (headerToken) {
    return String(headerToken).trim().toUpperCase();
  }
  const auth = req.headers["authorization"];
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim().toUpperCase();
  }
  return "";
}

module.exports = { applyCors, extractToken };
