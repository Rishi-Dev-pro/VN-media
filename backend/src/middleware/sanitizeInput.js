/**
 * Recursively sanitize request body, query parameters, and URL parameters
 * by removing keys starting with '$' or containing '.' to neutralize MongoDB
 * operator injection attacks (e.g. { "$ne": null }).
 */
function isPlainObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

function sanitize(data) {
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      if (isPlainObject(data[i]) || Array.isArray(data[i])) {
        sanitize(data[i]);
      }
    }
  } else if (isPlainObject(data)) {
    for (const key of Object.keys(data)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete data[key];
      } else if (isPlainObject(data[key]) || Array.isArray(data[key])) {
        sanitize(data[key]);
      }
    }
  }
}

const sanitizeInput = (req, res, next) => {
  try {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = sanitizeInput;
