## Getting started

_Wombat Dressing Room_ allows you to create secure tokens for publishing to the
npm registry from automated systems. Follow the steps below to generate a token:

### Generating per-package publication tokens

1. click [Manage tokens](/_/manage-tokens), under _Actions_.
2. enter a _package name_, in the text area provided.
3. click `Create Token`.
4. use the token generated to publish to the corresponding _package name_.

### Generating 24 hour and release-backed tokens

1. set `Wombat Dressing Room` as your default registry, `npm config set registry {{registryHref}}`.
2. `npm login`.
3. Click the `Create release-backed publication token` or
   `Create 24 hour token` button.
4. Your `~/.npmrc` will now be populated with a token which you can either use
   locally, or copy for use in automation tasks.
