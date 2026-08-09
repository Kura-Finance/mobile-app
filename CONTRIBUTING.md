# Contributing

Thanks for helping improve the Kura mobile client.

## Before you start

1. Read [docs/transparency.md](docs/transparency.md) and [docs/getting-started.md](docs/getting-started.md).
2. Copy `.env.example` → `.env` and fill **Privy** + **WalletConnect** at minimum.
3. Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development

```bash
npm install
npx expo prebuild
npx expo start -c
```

Checks before opening a PR:

```bash
npm test
npm run lint
npx tsc --noEmit
```

## Pull requests

- Keep PRs focused; prefer small, reviewable diffs.
- Do not commit `.env`, keystores, or `android/gradle.properties` / `local.properties`.
- Match existing TypeScript, i18n (`en` + `zh-TW`), and module layout under `src/`.
- Update docs when you change env vars, trust boundaries, or public APIs.
- Brand / trademark: see [NOTICE](NOTICE) and [docs/fork-guide.md](docs/fork-guide.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License (see [LICENSE](LICENSE)).
