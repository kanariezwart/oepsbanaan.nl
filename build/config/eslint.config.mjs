export default [
    {
        files: ["**/build/tests/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                // Node.js
                require: "readonly",
                module: "writable",
                exports: "writable",
                __dirname: "readonly",
                __filename: "readonly",
                process: "readonly",
                console: "readonly",
                Buffer: "readonly",
                // Browser globals used inside page.evaluate() callbacks
                document: "readonly",
                window: "readonly",
                HTMLMediaElement: "readonly",
                DOMException: "readonly",
            },
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": "warn",
            "no-var": "error",
            "prefer-const": "error",
            "eqeqeq": "error",
            "curly": "error",
            "no-console": "warn",
            "no-global-assign": "error",
        },
    },
    {
        files: ["**/assets/site/js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                URL: "readonly",
                console: "readonly",
                location: "readonly",
                navigator: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
            },
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": "warn",
            "no-debugger": "warn",
            "eqeqeq": "error",
            "no-var": "error",
            "prefer-const": "error",
            "no-console": "warn",
            "curly": "error",
        },
    },
];
