# wombat-dressing-room

This is an npm registry proxy designed to reduce the attack surface of npm publish and google packages.

`npm publish`es are made from a single npm account with 2fa enabled.

`npm publish`es can be made using the npm cli just using this service as the registry. see the [Documentation](docs/usage.md) for information about how to use this service.


# deployment

This service is deployed in 2 distinct App Engine accounts; an external account for registry access, and a protected internal account for authentication.

# setup

To run a copy of this service yourself.

## install

`npm install`

## Configure

wombat-dressing-room uses [dotenv](https://www.npmjs.com/package/dotenv) for configuration.

In order to start this service in development you need to create a `local.env`, in order to deploy you'll need an `external.env` and `internal.env` file at the root of the project.

Set the following environment variables to enable these configurations:

* `INTERNAL_ENV_PATH`: path to environment file used to configure login server.
* `EXTERNAL_ENV_PATH`: path to environment file used to configure npm proxy.
* `DATASTORE_PROJECT_ID`: ID of project to write datastore indices to.

### Local Environment Variables

the local environment just runs a single process on `http://localhost:8080` it needs the path to your service account keys, a github oauth application, and npm credentials 

```sh
GOOGLE_APPLICATION_CREDENTIALS={path to json. only needed in development}
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT_ID={your pantheon project id. DEFAULT: wombat-dressing-room}
LOGIN_ENABLED=yes-this-is-a-login-server
LOGIN_URL=http://localhost:8080
REGISTRY_URL=http://localhost:8080
```

### Internal Environment Variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT_ID={your pantheon project id. DEFAULT: wombat-dressing-room}
LOGIN_ENABLED=yes-this-is-a-login-server
LOGIN_URL=https://protected-login-url
REGISTRY_URL=https://public-registry-url
```

### External Environment Variables

```
NPM_OTP_SECRET={the text value of the otp secret}
NPM_TOKEN={the npm token}
GITHUB_CLIENT_ID={github app id}
GITHUB_CLIENT_SECRET={github app secret}
DATASTORE_PROJECT_ID={your pantheon project id. DEFAULT: wombat-dressing-room}
LOGIN_ENABLED=this-is-not-enabled
LOGIN_URL=https://protected-login-url
REGISTRY_URL=https://public-registry-url
```

# Start the service

local development config. uses local.env.

`npm run start-local`

# Stage

there is no stage! this should be fixed.

## Release

`npm run deploy`

## Contributing

Contributions welcome! See the [Contributing Guide](https://github.com/googleapis/wombat-dressing-room/blob/master/CONTRIBUTING.md).

## License

Apache Version 2.0
