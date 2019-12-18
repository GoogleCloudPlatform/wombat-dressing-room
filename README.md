# Wombat Dressing Room

This is an npm registry proxy designed to reduce the attack surface of npm packages.

`npm publish`es are made from a single npm account with 2fa enabled.

`npm publish`es can be made using the npm CLI just using this service as the registry. see the [Documentation](docs/usage.md) for information about how to use this service.

# Deployment

This service is deployed in 2 distinct App Engine accounts; an external account for registry access, and a protected internal account for authentication.

_TODO: flesh this section out with documentation on how a non Googler can create
a protected proxy for their registry._

# Setup

To run a copy of this service yourself.

## Install

`npm install`

## Configure

wombat-dressing-room uses [dotenv](https://www.npmjs.com/package/dotenv) for configuration.

In order to start this service in development you need to create a `local.env`, in order to deploy you'll need an `config/external.env` and `config/internal.env` inside
your project.

### Local environment variables

The local environment just runs a single process on `http://localhost:8080` it needs the path to your service account keys, a GitHub OAuth application, and npm credentials.

### Internal environment variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT_ID={your project id}
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
DATASTORE_PROJECT_ID={your project id}
LOGIN_ENABLED=this-is-not-enabled
LOGIN_URL=https://protected-login-url
REGISTRY_URL=https://public-registry-url
```

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
