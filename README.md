# Wombat Dressing Room

> Google's npm registry proxy. Designed to reduce the attack surface of npm packages.

[![Build Status](https://github.com/GoogleCloudPlatform/wombat-dressing-room/workflows/ci/badge.svg)](https://github.com/GoogleCloudPlatform/wombat-dressing-room/actions)
[![Known Vulnerabilities](https://snyk.io/test/github/GoogleCloudPlatform/wombat-dressing-room/badge.svg)](https://snyk.io/test/github/GoogleCloudPlatform/wombat-dressing-room)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)

## What it does

- You publish to _Wombat Dressing Room_, and it enforces additional security
  rules, before redirecting to _registry.npmjs.org_.

- Publishes are made from a single npm account with 2FA enabled (_a
  bot account_).

- Publishes can be made using the npm CLI, by making _Wombat Dressing Room_
  the default registry
  (_`npm config set registry https://external-project.appspot.com`_).

## Deployment

This service is deployed in 2 distinct services: an external service
for registry access; and a protected service for authentication/authorization
(you can use a proxy, such as [IAP](https://cloud.google.com/iap/), to
limit access to the authentication server).

### Prerequisites

_Wombat Dressing Room_ requires:

- a [Google Cloud Platform](https://cloud.google.com/) account to deploy to.
- an [npm account](https://www.npmjs.com/signup), to act as your
  publication bot.
- and a [GitHub OAuth Application](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/)
  to perform authentication and authorization.

#### Create an npm account

You will need to create an npm account, which will be used for publication.
This account should be configured such that 2FA is enabled for `authentication`
and `publication`. When you are given a QR code to scan for your authenticator
app, use a QR code reader to fetch and store the secret associated with the
2FA configuration. You will also need to scan the QR code with an authenticator
app, so that you can provide an OTP token to npm.

#### Create a GitHub OAuth Application

As well as an npm account, you must create a GitHub OAuth application. These
credentials are used when performing authenication: both when logging into
_Wombat Dressing Room_, for creating tokens, and when verifying certain types
of tokens.

_Note: the Authorization callback configured with the OAuth application
should be the URL of the internal service, with the suffix `/oauth/github`._

### Setup your environment

Once you've addressed the prerequisites, you should create environment files in
the `config/` directory populating the appropriate variables.

In order to start this service in development you need to create a
`config/local.env`, in order to deploy you'll need an `config/external.env` and
`config/internal.env`.

#### Internal environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT={project datastore is configured for}
LOGIN_ENABLED=yes-this-is-a-login-server
LOGIN_URL=https://project.appspot.com]
REGISTRY_URL=https://external-project.appspot.com
```

#### External environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT={project datastore is configured for}
LOGIN_ENABLED=this-is-not-enabled
LOGIN_URL=https://project.appspot.com]
REGISTRY_URL=https://external-project.appspot.com
```

#### Development environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT={project datastore is configured for}
LOGIN_ENABLED=yes-this-is-a-login-server
LOGIN_URL=http://127.0.0.1:8080
REGISTRY_URL=hhttp://127.0.0.1:8080
```

### Deploy the application

To configure the Google App Engine services used by _Wombat Dressing Room_,
perform an initial deployment:

1. install the [gcloud command line tool](https://cloud.google.com/sdk/gcloud/),
   and run `gcloud auth login`.
1. run `GCLOUD_PROJECT=my-project npm run deploy`, where `my-project` is the
   project configured in _Prerequisites_.

### Create a datastore table

The tokens used by _Wombat Dressing Room_ are stored in a datastore table,
before accessing the application for the first time you should run:

```bash
GCLOUD_PROJECT=my-project npm run create-indexes
```

To populate this datastore schema.

_Note: it takes datastore a while to initialize the first time you run the
application. You can view the status of index creation in the
[Cloud Console](http://cloud.google.com/console)._

### Protect your application with IAP

Wombat Dressing Room consists of an internal application, used for
authorization, and an external app, used for proxing to npm. You should limit
access to the internal application, a great way to do so is with
[IAP](https://cloud.google.com/iap/docs/app-engine-quickstart): configuring
the `default` application, such that only select accounts have access; and
configuring the `external` application with the `allUsers` group,
such that anyone can access the proxy.

## Developing the service locally

Populate `config/local.env`, and run:

`npm run develop`

## Deploying updates

Populate `config/external.env`, and `config/internal.env`, and run:

`npm run deploy`

## Contributing

Contributions welcome! See the [Contributing Guide](https://github.com/GoogleCloudPlatform/wombat-dressing-room/blob/master/CONTRIBUTING.md).

## License

Apache Version 2.0
