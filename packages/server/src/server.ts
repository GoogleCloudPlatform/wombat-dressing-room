/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as path from 'path';
import * as url from 'url';
import * as morgan from 'morgan';
import * as express from 'express';
import cookieSession = require('cookie-session');
import * as request from 'request';
import uuid = require('uuid');
import * as validatePackage from 'validate-npm-package-name';

import * as datastore from './lib/datastore';
import {drainRequest} from './lib/drain-request';
import * as github from './lib/github';
import * as Config from './lib/config';
import {json} from './lib/json';
import {require2fa} from './lib/packument';
import {totpCode} from './lib/totp-code';
import * as unsafe from './lib/unsafe';

import {publish} from './routes/publish';
import {putDeleteTag} from './routes/put-delete-tag';
import {putDeleteVersion} from './routes/put-delete-version';

import {WriteResponse} from './lib/write-package';

const log = console.log;
console.log = (...args) => {
  log(new Date().toISOString(), ...args);
};
const error = console.error;
console.error = (...args) => {
  error(new Date().toISOString(), ...args);
};

const ONE_DAY = 1000 * 60 * 60 * 24;
const app = express();

// Configure request logger:
const uuidregex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
morgan.token('cleanurl', (req: express.Request) =>
  req.url.replace(uuidregex, '<token>')
);
app.use(
  morgan(
    ':date[iso] :remote-addr :remote-user :method :cleanurl HTTP/:http-version :status :res[content-length] - :response-time ms',
    {stream: process.stdout}
  )
);

/*
 * Allows routes to be selectively protected from CSRF attacks.
 * this problem should also be addressed by using sameSite: 'lax', to
 * prevent cookies from being posted by external sites.
 */
function avoidCSRF(req: express.Request, res: express.Response) {
  const origin = req.headers.referer || req.headers.origin;
  // light CSRF check.
  if (origin && origin.indexOf(process.env.LOGIN_URL || '') !== 0) {
    const logid = uuid.v4();
    console.log('token service csrf error ' + logid, req.headers);
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error:
          'please refresh the page and try your request again. support id: ' +
          logid,
      })
    );
    return true;
  }
  return false;
}

/*
 * Static routes. Each of /, /_/help, /_/login, etc.,
 * serves react app bundle.
 */
/*
 * When running tests, `ts-node` runs from the `src` directory.
 * In production, the code is run from the `build` directory.
 * This conditional path ensures that the static assets are found in both environments.
 */
const staticRoot =
  process.env.NODE_ENV === 'test'
    ? path.join(__dirname, '../../../public')
    : path.join(__dirname, '../../../../public');
app.get('/', (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }
  res.sendFile('index.html', {
    root: staticRoot,
  });
});
app.use(express.static(staticRoot));
app.get('/_/help', (_req, res) => {
  res.sendFile('index.html', {
    root: staticRoot,
  });
});
app.get('/_/login', (_req, res) => {
  res.sendFile('index.html', {
    root: staticRoot,
  });
});
app.get('/_/manage', (_req, res) => {
  res.sendFile('index.html', {
    root: staticRoot,
  });
});

/*
 * Middleware to extract npmrc namespace, and add
 * to request object.
 */
app.use((req, _res, next) => {
  // handle namespaces
  const matches = req.url.match(/^(.+)(\/_ns\/|\/_ns$)/);
  if (matches) {
    req.npmrcNamespace = matches[1];
    req.url = req.url.substr(matches[0].length);
    if (!req.url.length) {
      req.url = '/';
    } else {
      req.url = '/' + req.url;
    }
  }

  // handle package urls. assume that if write=true is sent its a metadata
  // request /package?write=true
  if (req.query.write === 'true') {
    // this is a package metadata request
    req.url = '/_/metadata' + req.url;
  }
  next();
});

// Configure cookie backed session with some CSRF protections.
app.use(
  cookieSession({
    name: 'session',
    keys: [Config.config.sessionSecret || 'wombats are fun'],
    // Prevent CSRF by requiring same site for POSTs.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite#lax
    sameSite: 'lax',
  })
);

/*
 * Redirct to login server if attempt is made to interact with frontend
 * API endpoints against server that does not have frontend enabled.
 */
const redirectToLoginServer = (req: express.Request, res: express.Response) => {
  console.log(
    'Debug: redirectToLoginServer called.',
    'loginEnabled:',
    Config.config.loginEnabled,
    'process.env.LOGIN_ENABLED:',
    process.env.LOGIN_ENABLED,
    'userLoginUrl:',
    Config.config.userLoginUrl
  );
  if (!Config.config.loginEnabled) {
    if (req.query.redir) {
      res.end('login disabled and there is maybe a redirect loop.');
    } else if (Config.config.userLoginUrl) {
      res.redirect(Config.config.userLoginUrl + req.path);
    } else {
      res.end("these are not the droids you're looking for");
    }
    return true;
  }
  return false;
};

/*
 * handle "npm login", returns a polling URL which will be called
 * until authentication completes.
 */
app.post(
  '/-/v1/login',
  wrap(async (req, res) => {
    // serve a new token to the npm cli.
    // If they've provided an npmrcNamespace add it to the loginUrl as a
    // package name hint
    const packageNameHint = req.npmrcNamespace
      ? '&package=' + encodeURIComponent(req.npmrcNamespace.substr(1))
      : '';
    const token = await datastore.saveHandoffKey(
      datastore.generatePublishKey()
    );
    res.end(
      `{"doneUrl":"${Config.config.userRegistryUrl}/_/done?ott=${token}","loginUrl":"${Config.config.userLoginUrl}?ott=${token}${packageNameHint}"}`
    );
  })
);

/*
 * Enable 2FA for req.query.packageName.
 */
app.post(
  '/_/2fa',
  wrap(async (req, res) => {
    const packageName = (req.query.packageName as string) || '';
    let result: {status: number; data: Buffer} | undefined;
    try {
      result = await require2fa(
        packageName,
        Config.config.npmToken,
        totpCode(Config.config.totpSecret)
      );
    } catch (e) {
      return res.end(
        '{"error":"server error setting required 2fa on package"}'
      );
    }

    res.statusCode = result ? result.status : 500;
    if (res.statusCode === 200) {
      res.end('"ok"');
    } else {
      res.end('oh no');
    }
  })
);

/*
 * Called during CLI authentication to check whether website
 * login is complete.
 */
app.get(
  '/_/done',
  wrap(async (req, res) => {
    // eslint-disable-next-line node/no-deprecated-api
    const parsed = url.parse(req.url, true);
    const query = parsed.query || {};

    const handoff = await datastore.getHandoffKey(query.ott + '');
    if (!handoff) {
      // to prevent the cli form falling back to couchdb auth we send a
      // 200 but no token. this leaves quite a bit to be desired as far as
      // messaging in the cli but prevents falling back to an interactive
      // login.
      res.status(200);
      res.header('npm-notice', 'The one time token expired or is invalid.');
      res.end('{"token":""}');
    } else if (!handoff.complete) {
      res.header('retry-after', '3');
      res.status(202);
      res.end('{}');
    } else if (handoff.complete) {
      res.end(JSON.stringify({token: handoff.value}));
    }
  })
);

/*
 * So you can fetch package documents from wombot if '?write=true' is in the
 * query string. required for npm deprecate.
 */
app.get('/_/metadata/:package', (req, res) => {
  console.log(
    'proxying write metadata request to npm for ',
    req.params.package
  );
  request('https://registry.npmjs.org/' + req.params.package).pipe(res);
});

/*
 * If a session exists, return currently logged in account information.
 */
app.get(
  '/_/account',
  wrap(async (req, res) => {
    if (redirectToLoginServer(req, res)) {
      return;
    }
    res.header('Content-type', 'application/json');

    const account = {
      registryHref: Config.config.userRegistryUrl || 'http://127.0.0.1:8080',
      authenticated: false,
    } as {
      flash?: string;
      registryHref: string;
      login?: string;
      ott?: string;
      authenticated: boolean;
    };

    // Store OTT from npm CLI login, and send back to frontend:
    if (req.query.ott) {
      req.session!.ott = req.query.ott;
    }
    if (req.session!.ott) {
      account.ott = req.session!.ott;
    }

    // Display flash pop up message on frontend:
    if (req.session!.flash) {
      account.flash = req.session!.flash;
      req.session!.flash = undefined;
    }

    if (req.session!.token) {
      account.login = req.session!.user.login;
      account.authenticated = true;
      res.send(account);
    } else {
      res.send(account);
    }
  })
);

/*
 * Redirect link for login with GitHub.
 */
app.get(
  '/_/login-link',
  wrap(async (req, res) => {
    if (redirectToLoginServer(req, res)) {
      return;
    }
    res.header('Content-type', 'application/json');
    const {link} = github.webAccessLink(
      Config.config.githubId,
      Config.config.githubSecret,
      []
    );
    res.send({
      link,
    });
  })
);

/*
 * Logout of Wombat Dressing Room session
 */
app.post('/logout', (req, res) => {
  unsafe.clearSession(req);
  res.end('"ok"');
});

/*
 * GitHub OAuth callback.
 */
app.get(
  '/oauth/github',
  wrap(async (req, res) => {
    // https://github.com/login/oauth/access_token
    if (!Config.config.loginEnabled) {
      res.end('service disabled.');
    }

    if (!req.query || !req.query.code) {
      res.status(403);
      res.send('error processing login. <a href="/">try again</a>.');
      return;
    }

    try {
      const token = await github.webAccessToken(
        Config.config.githubId,
        Config.config.githubSecret,
        req.query.code as {} as string
      );

      const query = req.session!.query;
      delete req.session!.query;
      const user = await github.getUser(token);

      await datastore.createUser(user.login, token);

      if (query && query.token) {
        delete query.token;
        query.keyCreated = 1;

        await datastore.savePublishKey(user.login, query.token);
      }

      req.session!.user = unsafe.ghUserData(user) as {[k: string]: string};
      req.session!.token = token;
      req.session!.flash = JSON.stringify({
        severity: 'success',
        message: `Logged in as ${req.session!.user.login}`,
      });
      // resume adding a key =)
      if (req.session!.loginRedirect) {
        return res.redirect(req.session!.loginRedirect);
      }
      res.redirect('/');
    } catch (e) {
      res.status(401);
      // TODO: stop showing real error.
      console.log('error logging in ' + e);
      res.send('error logging in. <br/><a href="/">please try again</a> ');
    }
  })
);

/*
 * Create a token, potentially tied to an ott if token was created
 * from npm CLI.
 */
app.put(
  '/_/token',
  wrap(async (req, res) => {
    if (redirectToLoginServer(req, res)) {
      return;
    }
    res.header('content-type', 'application/json');

    const result = (await drainRequest(req)) + '';
    const body = json(result);
    console.log('token request with body', body);

    // TODO handle
    if (!req.session!.token) {
      req.session!.loginRedirect = req.url;
      // not logged in.
      return res.redirect('/');
    }

    let ttl = undefined;
    let releaseAs2FA = undefined;
    if (body.type === 'ttl') {
      ttl = Date.now() + ONE_DAY;
    } else if (body.type === 'release') {
      releaseAs2FA = true;
    } else if (
      !body.packageName ||
      !(body.packageName as string).trim().length
    ) {
      res.statusCode = 400;
      return res.end({error: 'package name required'});
    }

    const handoff = body.ott
      ? await datastore.getHandoffKey(body.ott + '')
      : null;
    const token = handoff ? handoff.value : uuid.v4();
    const name = body.packageName ? (body.packageName + '').trim() : undefined;
    await datastore.savePublishKey(
      req.session!.user.login,
      token,
      name,
      ttl,
      releaseAs2FA,
      body.monorepo
    );

    if (handoff) {
      req.session!.ott = null;
      await datastore.completeHandoffKey(body.ott + '');
      res.end(
        JSON.stringify({
          message:
            'Token created! You may close this page and return to terminal.',
        })
      );
    } else {
      res.end(
        JSON.stringify({
          message: `Created token "${token}" this token will never be shown again, copy it somewhere safe.`,
        })
      );
    }
  })
);

/*
 * Retrieve list of existing tokens for management screen.
 */
app.get('/_/api/v1/tokens', (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }

  datastore
    .getPublishKeys(req.session!.user.login)
    .then(keys => {
      // CANNOT SEND REAL KEY TO THE FRONTEND.
      const cleaned: Array<{
        created: number;
        prefix: string;
        package?: string;
        expiration?: number;
        'release-backed'?: boolean;
      }> = [];
      keys.forEach(row => {
        cleaned.push({
          created: row.created,
          prefix: row.value.substr(0, 5),
          package: row.package,
          expiration: row.expiration,
          'release-backed': row.releaseAs2FA,
        });
      });

      res.end(JSON.stringify({error: false, data: cleaned}));
    })
    .catch(e => {
      const code = uuid.v4();
      console.log(
        'error loading user tokens list ' +
          req.session!.user.login +
          ' error:\n' +
          e
      );
      res.end(
        JSON.stringify({
          error: 'error loading tokens. contact support with code ' + code,
        })
      );
    });
});

/*
 * Delete a token from wombat dressing room.
 */
app.delete('/_/api/v1/token', async (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }

  if (avoidCSRF(req, res)) {
    return;
  }

  const result = (await drainRequest(req)) + '';
  const body = json(result);

  if (!body) {
    return res.end(JSON.stringify({error: 'malformed json request body'}));
  }

  const prefix = body.prefix || '';
  const created = body.created || 0;

  if (!prefix || !created) {
    return res.end(
      JSON.stringify({
        error: 'missing token prefix or created in json request body',
      })
    );
  }

  datastore
    .getObfuscatedPublishKey(req.session!.user.login, created, prefix)
    .then(async key => {
      let error;
      if (key) {
        await datastore.deletePublishKey(key.value);
      } else {
        error = "couldn't find key";
      }

      res.end(JSON.stringify({error, data: !!key}));
    })
    .catch(e => {
      const code = uuid.v4();
      console.log(
        'error deleting token ' + req.session!.user.login + ' error:\n' + e
      );
      res.end(
        JSON.stringify({
          error: 'error loading tokens. contact support with code ' + code,
        })
      );
    });
});

type Handler = (
  req: express.Request,
  res: express.Response
) => Promise<void | WriteResponse> | void;

/*
 * Used to wrap requests, providing a better human readable
 * output for unknown errors.
 */
function wrap(a: Handler) {
  return (req: express.Request, res: express.Response) => {
    const p = a(req, res);
    if (p) {
      p.catch(e => {
        const id = uuid.v4().replace(/[-]+/g, '');
        console.error(
          'unhandled request handler rejection. ' +
            id +
            ' ' +
            JSON.stringify(e + e.stack)
        );
        res.status(500);
        res.end('server error ping support with id: ' + id);
      });
    }
  };
}

/*
 * Proxy metadata requests to npm registry.
 */
app.get(/^\/[^/]+$/, (req, res, next) => {
  const pkg = decodeURIComponent(req.url.substr(1));
  console.log('proxying metadata request to npm for ', pkg);
  if (validatePackage(pkg).validForOldPackages) {
    request('https://registry.npmjs.org/' + req.url).pipe(res);
    return;
  }
  next();
});

/*
 * npm dist-tag list
 */
app.get('/-/package/:package/dist-tags', (req, res) => {
  request('https://registry.npmjs.org' + req.url).pipe(res);
});

/*
 * npm whoami
 */
app.get(
  '/-/whoami',
  wrap(async (req, res) => {
    const auth = req.headers['authorization'] + '';
    const token = auth.split(' ').pop();
    const pubKey = await datastore.getPublishKey(token + '');

    if (pubKey) {
      return res.end(`{"username":"github_user:${pubKey.username}"}`);
    }

    res.end('{}');
  })
);

/*
 * npm access commands.
 */
app.post('/-/package/:package/access', (req, res) => {
  res.end('not supported');
});

/*
 * npm publish
 */
app.put(/^\/[^/]+$/, wrap(publish));
/*
 * npm dist-tag add
 */
app.put('/-/package/:package/dist-tags/:tag', wrap(putDeleteTag));
/*
 * npm dist-tag rm
 */
app.delete('/-/package/:package/dist-tags/:tag', wrap(putDeleteTag));
/*
 * npm unpublish -f
 */
app.delete('/:package/-rev/:tag', wrap(putDeleteVersion));
/*
 * npm unpublish
 */
app.delete('/:package/-/:tarball/-rev/:sha', wrap(putDeleteVersion));
/*
 * npm unpublish
 */
app.put('/:package/-rev/:sha', wrap(putDeleteVersion));

const port = process.env.PORT || 8080;

if (module === require.main) {
  app.listen(port, () => {
    console.log(`listening on ${port}`);
  });
}

export default app;
