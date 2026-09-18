## Description
Briefly describe the changes introduced in this pull request and the rationale behind them.

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 UI/UX styling or asset refinement
- [ ] ⚙️ CI/CD or tooling improvement

## MCP Protocol & Architectural Checklist
- [ ] Standard I/O purity: Confirmed **no** `console.log()` calls output to standard output during stdio transport (all logging uses `stderr`).
- [ ] Standardized errors: Tool errors return `{ isError: true, content: [...] }` without crashing the process.
- [ ] Dual-transport compatibility: Tested on both `stdio` and `http` transports.
- [ ] Type safety: TypeScript compiles without errors (`npm run typecheck`).
- [ ] Assets bundled: `npm run build` succeeds and copies web simulator assets to `dist/web/public/`.
- [ ] Automated tests: All unit and integration tests pass (`npm test`).

## How Has This Been Tested?
Please describe the tests you ran to verify your changes:
1. ...
2. ...
