# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Adding a New Proposal

To add a new proposal to the site:

1. **Create a Markdown file** in the `content/proposals/` directory. Use a descriptive filename, e.g. `client-name-project-title.md`.
2. **Add the following frontmatter** at the top of your file (update the values as needed):

```yaml
---
title: Your Proposal Title
description: A short summary of the proposal's purpose and value.
keywords: keyword1, keyword2, keyword3
client: Client Name
date: YYYY-MM-DD
estimatedCost: $X,XXX–$Y,YYY/month
timeline: Project timeline or delivery estimate
---
```

3. **Write your proposal content** below the frontmatter, using Markdown for formatting.

### Example

```markdown
---
title: Your Proposal Title
description: A short summary of the proposal's purpose and value.
keywords: keyword1, keyword2, keyword3
client: Client Name
date: YYYY-MM-DD
estimatedCost: $X,XXX–$Y,YYY/month
timeline: Project timeline or delivery estimate
---

# Your Proposal Title

...rest of your proposal...
```

- Make sure to keep the frontmatter at the very top of the file.
- Use clear, descriptive values for each field.
- For more examples, see existing files in `content/proposals/`.

## Proposal Access Password

To access the proposals section on the site, a password is required. This password is currently hardcoded in the file `pages/proposals/index.vue`.

- **Default password:** `$p1ckl3s!`
- To change the password, open `pages/proposals/index.vue` and update the following line:

  ```js
  if (password.value === '$p1ckl3s!') {
  ```

- After changing the password, redeploy or restart your development server for the change to take effect.

**Note:** For improved security, consider moving the password to an environment variable or a secure storage solution if you need to change it frequently or use different passwords for different environments.
