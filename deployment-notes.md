# GAS Backend Deployment Notes

- Maintain the Apps Script project as the source of truth for the backend.
- The frontend should not read secrets directly.
- Use `google.script.run` when the UI is embedded into the Google Apps Script web app.
- Use a public REST endpoint for external static hosting.
- Keep session validation and origin checks enabled.
