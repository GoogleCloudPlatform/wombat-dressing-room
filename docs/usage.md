
Welcome! to get started you'll have to do a few steps.

- login to this registry proxy
- if your package already exists add the publish user to your package
- if you're publishing to an organization package make sure to add the account associated
  with your npm token to the organization.
- configure ci with the token and point the publish command to this registry proxy

detailed instructions are below

## Login

```sh
npm login --registry https://your-registry-url
```

This will open a new browser tab to a app which asks you to connect with github. 

- The github application asks for NO permissions. only access to public data. no rights to push or anything.

Once you do, a new auth token will be written to your `~/.npmrc` to configure CI you'll need to copy this into your config just like configuring npm for ci normally.

```
//your-registry-url.appspot.com/:_authToken=<auth token here>
```

this proxy does not support `npm token *` commands at this time. but here is the important part of npm's doc for adding a token to ci.
https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow#set-the-token-as-an-environment-variable-on-the-cicd-server

If you follow these docs remember to replace `registry.npmjs.org` with `your-registry-url.appspot.com` 

### Per package tokens

The tool is configured to require a unique token per package.

## NPM Configuration

The whole point of this service is to reduce the attack surface area of npm packages. In order to do that a couple things need to be done on npm.

### new package

- if this is a new package you're already done, skip to publish.
    - the new package.json must have a repository field that points to github and you github user must be able to access the repo.

```js
"repository":"some-gh-user/some-repo"
```

### existing package

- add the robot publish user to the package
    - run `npm owner add your-user-account <my package>`
    - or add your user account via the npm website package admin ui
        - https://www.npmjs.com/~google-wombot

- require 2fa for publishes
    - run `npm access 2fa-required <my package>`
    - or via the website. npm docs for using the website ui https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification

- remove all other users
    - if at all possible there should be no other owners on npm. no other users with publish access.
    - you can publish any time via the publish service.
    - if the publish service is for any reason down or doesn't seem to work you can reach out to `node-team@`

## Publishing

### Publish

To publish you'll need to specify the registry via the `--registry` flag. 

```sh
npm publish --registry https://your-registry.appspot.com
```

This is perfect for ci where you configure once.

### I dont like passing flags

If you prefer not to remember the `--registry` flag. 
Add `publishConfig` to the package.json of your project like so.

```js
"publishConfig":{
    "registry":"https://your-registry.appspot.com"
}
```

if that's in your package.json you can just run `npm publish` or use tools like `np`

## FAQ

### what is this.

- this is an npm registry proxy that uses 2fa to publish without human intervention.
- this cannot be used as a full proxy registry because it doesn't pass through requests you would use to install etc.

### i have a question who do i ask

- feel free to email node-team@ and we'll be happy to answer your question and add it to this FAQ

### having google-wombot as the only maintainer of my package hurts my brand or may confuse users about who to contact for support

- please let us know! this might be a great feature request