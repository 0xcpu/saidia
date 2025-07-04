module.exports = {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'avoid',
    endOfLine: 'lf',
    overrides: [
      {
        files: 'manifest.json',
        options: {
          parser: 'json',
          tabWidth: 2,
        },
      },
    ],
};
