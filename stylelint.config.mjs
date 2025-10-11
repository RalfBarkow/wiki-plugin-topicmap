/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["@double-great/stylelint-a11y", "stylelint-no-unsupported-browser-features"],
  rules: {
    "function-no-unknown": [true, { ignoreFunctions: ["color-mix"] }],
    "a11y/no-outline-none": true,
    "plugin/no-unsupported-browser-features": [true, { severity: "warning" }]
  },
  overrides: [
    { files: ["**/*.html", "**/*.vue"], customSyntax: "postcss-html" }
  ]
};
