/** @type {import('stylelint').Config} */
module.exports = {
    extends: ["stylelint-config-standard"],
    rules: {
        "property-no-vendor-prefix": [true, {ignoreProperties: ["appearance"]}],
        "color-function-alias-notation": null,
        "color-function-notation": null,
        "alpha-value-notation": null,
        "declaration-block-no-duplicate-properties": true,
        "block-no-empty": true
    }
};