'use strict';

// This is a JavaScript-based config file containing every Mocha option plus others.
// If you need conditional logic, you might want to use this type of config.
// Otherwise, JSON or YAML is recommended.

module.exports = {
  exit: true, // could be expressed as "'no-exit': true"
  spec: ['test/app.test.js', 'test/**/*.test.js'],
  timeout: 600000,
};
