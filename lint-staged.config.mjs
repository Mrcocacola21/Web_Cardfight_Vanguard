export default {
  '*.{js,jsx,ts,tsx,mjs,cjs}': [
    'prettier --write',
    'eslint --fix --max-warnings=0',
  ],
  '*.{json,md,mdx,yaml,yml,css}': ['prettier --write'],
}
