export default [
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
        },
    },
];
