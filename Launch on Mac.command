#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; fi
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Install Node.js 24 LTS from https://nodejs.org, then open this launcher again.'
  read '?Press Enter to close.'
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<13))process.exit(1)' || { print 'Node.js 22.13 or later is required. Install Node.js 24 LTS.'; read '?Press Enter to close.'; exit 1; }
if [ ! -x node_modules/.bin/vinext ]; then
  print 'Installing the app dependencies. Internet is needed for this first step.'
  npm ci || { print 'Installation failed. Check your connection and Node.js version.'; read '?Press Enter to close.'; exit 1; }
fi
if [ ! -f .env ]; then cp .env.example .env; fi
print 'Starting SANKET. Open the Local address printed below. Keep this window open.'
npm run dev
read '?Press Enter to close.'
