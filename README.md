# Wombat Dressing Room

This is an npm registry proxy designed to reduce the attack surface of npm packages.

`npm publish`es are made from a single npm account with 2fa enabled.

`npm publish`es can be made using the npm CLI just using this service as the registry. see the [Documentation](docs/usage.md) for information about how to use this service.

# Deployment

This service is deployed in 2 distinct App Engine accounts; an external account for registry access, and a protected internal account for authentication.

# Setup

To run a copy of this service yourself.

## Install

`npm install`

## Configure

wombat-dressing-room uses [dotenv](https://www.npmjs.com/package/dotenv) for configuration.

In order to start this service in development you need to create a `local.env`, in order to deploy you'll need an `config/external.env` and `config/internal.env` inside
your project.

### Internal environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
GCLOUD_PROJECT={your project id}
LOGIN_ENABLED=yes-this-is-a-login-server
LOGIN_URL=https://protected-login-url
REGISTRY_URL=https://public-registry-url
```

### External environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
GCLOUD_PROJECT={your project id}
LOGIN_ENABLED=this-is-not-enabled
LOGIN_URL=https://protected-login-url
REGISTRY_URL=https://public-registry-url
```

### Prerequisites

#### Create an npm account

You will need to create an npm account, which will be used or publication.
This account should be configured such that 2FA is enabled for `authentication`
and `publication`. When you are given a QR code to scan for an  authenticator
app, use a QR code reader to fetch and store the secret associated with the
2FA configuration. You will also need to scan the QR code with an authenticator
app, so that you can provide an OTP token to npm.

#### Create a GitHub OAuth Application

As well as an npm account, you must create a GitHub OAuth application. These
credentials are used when performing authorization checks.

#### Create a datastore table

The tokens used by Wombat Dressing Room are stored in a datastore table,
before running the application for the first time you should run:

```bash
npm run create-indexes
```

To populate this data structure.

#### Protect your application with IAP

Wombat Dressing Room consists of an internal application, used for authorization
and an external app, used for proxing to npm. You should limit access to the
internal application, a great way to do so is with
[IAP](https://cloud.google.com/iap/docs/app-engine-quickstart), configuring
the `default` application, such that only select accounts have access, and
configuring the `external` application such that anyone can access the proxy.

### Local environment variables

The local environment just runs a single process on `http://localhost:8080` it needs the path to your service account keys, a GitHub OAuth application, and npm credentials.

# Start the service

local development config. uses local.env.

`npm run start-local`

# Stage

There is no stage! this should be fixed.

## Release

`npm run deploy`

## Contributing

Contributions welcome! See the [Contributing Guide](https://github.com/googleapis/wombat-dressing-room/blob/master/CONTRIBUTING.md).

## License

Apache Version 2.0
