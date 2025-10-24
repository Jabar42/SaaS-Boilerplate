module.exports = {
  '**/*.{js,jsx,ts,tsx}': ['eslint --fix --no-warn-ignored'],
  '**/*.ts?(x)': () => 'npm run check-types',
  '**/*.{json,md,html,css,scss}': ['prettier --write'],
};
