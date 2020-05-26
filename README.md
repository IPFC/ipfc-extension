# Inter Planetary Flash Cards - Extension

Extension available on the [Chrome store](https://chrome.google.com/webstore/detail/inter-planetary-flash-car/ffjpplmcceibehbaofplbmcldkmmhcob/related?hl=en-US) and the [Firefox store](https://addons.mozilla.org/en-US/firefox/addon/inter-planetary-flash-cards)

Open source project hosted on [github](https://github.com/IPFC/ipfc-extension)

Quickly make flashcards and highlights from websites and sync them to multiplatform flashcard apps for review

Current build tested in Linux with Node v12.13.1

Built with boilerplate: [vue-web-extension](https://github.com/Kocal/vue-web-extension)

to install:
`$ npm install`
`$ npm run build`

dev:
`$ npm run build`
Build the extension into dist folder for production.

`$ npm run build:dev`
Build the extension into dist folder for development.

`$ npm run watch`
Watch for modifications then run npm run build.

`$ npm run watch:dev`
Watch for modifications then run npm run build:dev.
It also enable Hot Module Reloading, thanks to webpack-extension-reloader plugin.

⚠️ Keep in mind that HMR only works for your background entry.

`$ npm run build-zip`
Build a zip file following this format <name>-v<version>.zip, by reading name and version from manifest.json file. Zip file is located in dist-zip folder.
this will zip the build dist folder, so make sure you run `$ npm run build` first

## build from docker (currently only for production)

`$ docker pull jewcub/ipfc-extension`

`$ docker run -it jewcub/ipfc-extension`
to export the generated files back out:
in a new terminal
`$ docker ps`
find the container ID
`$ docker export <ID> > ipfc-extension-export.tar`
the project will be inside the 'app' folder. The zip will be inside dist-zip

local env build likes webpack.config `manifest: path.resolve(__dirname) + '/src/manifest.json',` but docker likes src/ with no prefix /
