module.exports = {
    env: {
      browser: true,
      es2021: true,
      webextensions: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:no-unsanitized/DOM',
    ],
    plugins: [
      'no-unsanitized',
      'mozilla',
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // Extension-specific security rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'mozilla/no-aComponents': 'error',
      'mozilla/balanced-listeners': 'error',
      'mozilla/no-arbitrary-setTimeout': 'error',
      
      // Content Security Policy 
      'no-inline-script': 'error',
      'no-unsanitized/method': 'error',
      'no-unsanitized/property': 'error',
      
      // Message passing
      'mozilla/valid-chrome-send': 'warn',
      
      // General best practices
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    overrides: [
      {
        files: ['background.js'],
        rules: {
          'no-console': 'off', // Background scripts can use console
        }
      }
    ]
  };
