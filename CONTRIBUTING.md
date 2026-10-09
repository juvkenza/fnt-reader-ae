# Contributing

Bug reports and pull requests are welcome.

- Open an issue first for larger changes.
- Run `npm test` before sending a PR. Logic that does not need After Effects (parsing, layout) belongs in `src/core` and should have a test.
- Keep the panel (`src/panel`) and the After Effects bridge (`src/host`) separate: the panel computes everything and sends one JSON payload to `fntReaderBuildComp`.
- Please don't commit third-party fonts or artwork; `tools/make-demo-font.js` generates the sample font.
- If you report a problem with a specific font, attach the `.fnt` and a small `.png` if you are allowed to share them.
