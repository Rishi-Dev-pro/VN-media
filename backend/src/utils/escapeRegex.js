/**
 * Escape special regex characters in dynamic user query strings to prevent ReDoS attacks.
 * @param {string} text - User provided search query string
 * @returns {string} Safe escaped string for RegExp constructor
 */
function escapeRegex(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex,
};
