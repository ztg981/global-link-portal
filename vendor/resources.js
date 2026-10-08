// Serve React from this site instead of unpkg.com (often slow or blocked in mainland China).
// Same files, byte-for-byte (sha384 matches the SRI pinned in support.js).
window.__resources = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'vendor/react-18.3.1/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'vendor/react-18.3.1/react-dom.production.min.js',
};
