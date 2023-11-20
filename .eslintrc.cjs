module.exports = {
  ignorePatterns: ['bin/*', 'dist/*'],
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 'latest'
  },
  env: {
    browser: true,
    node: true
  },
  rules: {
    'no-tabs': 0,
    'no-unexpected-multiline': 'error'
  }
}
