# LeetLens-AI

LeetLens is a local-first Chrome extension that captures failed LeetCode submissions and turns them into a structured mistake review notebook.

## MVP Stack

- TypeScript
- React
- Vite
- Chrome Extension Manifest V3
- IndexedDB + Dexie.js
- `chrome.storage.local` for lightweight settings

## Development

Install dependencies:

```bash
npm install
```

Run typecheck and build:

```bash
npm run build
```

Load the extension locally:

1. Build the project with `npm run build`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer Mode.
4. Click `Load unpacked`.
5. Select the generated `dist/` folder.

## Documentation

- [MVP PRD CN](docs/LeetLens_MVP_PRD_CN.md)
- [MVP PRD EN](docs/LeetLens_MVP_PRD_EN.md)
- [MVP Tech Design CN](docs/LeetLens_MVP_Tech_Design_CN.md)
- [MVP Tech Design EN](docs/LeetLens_MVP_Tech_Design_EN.md)
- [MVP Implementation Plan CN](docs/LeetLens_MVP_Implementation_Plan_CN.md)
- [MVP Implementation Plan EN](docs/LeetLens_MVP_Implementation_Plan_EN.md)
- [MVP Development Issues CN](docs/LeetLens_MVP_Development_Issues_CN.md)
