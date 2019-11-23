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

import * as express from 'express';
import * as fs from 'fs';
import * as morgan from 'morgan';
import * as url from 'url';

import * as datastore from './lib/datastore';

import cookieSession = require('cookie-session');
import * as github from './lib/github';
import {config} from './lib/config';
import {totpCode} from './lib/totp-code';
import * as request from 'request';
import {packument, findLatest, repoToGithub, require2fa} from './lib/packument';
import uuid = require('uuid');
import * as path from 'path';
import {Packument} from '@npm/types';
import {json} from './lib/json';
const validatePackage = require('validate-npm-package-name');


const ONE_DAY = 1000 * 60 * 60 * 24;
const unsafe = require('./lib/unsafe.js');
const app = express();

const readStatic = (p: string) => {
  return fs.readFileSync(path.resolve(__dirname + '/../../html', p));
};

const ghcss =
    fs.readFileSync(require.resolve('github-markdown-css/github-markdown.css'));
const favicon = readStatic('favicon.ico');
const documentation = readStatic('documentation.html') + '';
const appjs = readStatic('app.js');
const css = readStatic('app.css');
const loginPage = readStatic('login.html') + '';
const tokenSettingsPage = readStatic('token-settings.html') + '';
const manageTokensPage = readStatic('manage-tokens.html') + '';

const SUFFIX_STRING = '_ns';

let indexHtml = readStatic('index.html') + '';
// add documentation from rendered markdown
indexHtml = indexHtml.replace('{documentation}', documentation);

const uuidregex =
    /[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/ig;
morgan.token(
    'cleanurl',
    (req: express.Request) => req.url.replace(uuidregex, '<token>'));

app.use(morgan(
    ':remote-addr :remote-user :method :cleanurl HTTP/:http-version :status :res[content-length] - :response-time ms',
    {stream: process.stdout}));


app.use((req, res, next) => {
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

const serve = (p: string, data: string|Buffer, loginServer?: boolean) => {
  app.get(p, (req, res) => {
    if (loginServer && !config.loginEnabled) {
      res.statusCode = 401;
      return res.end();
    }
    res.end(data);
  });
};

serve('/favicon.ico', favicon);
serve('/app.js', appjs);
serve('/github-markdown.css', ghcss);
serve('/app.css', css);

// whoami
app.get('/-/whoami', wrap(async (req, res) => {
          const auth = req.headers['authorization'] + '';
          const token = auth.split(' ').pop();
          const pubKey = await datastore.getPublishKey(token + '');

          if (pubKey) {
            return res.end(`{"username":"github_user:${pubKey.username}"}`);
          }

          res.end('{}');
        }));

// publish
const writePackage = async(
    packageName: string, req: express.Request, res: express.Response): Promise<{
  statusCode: number,
  error?: string,
  newPackage?: boolean
}> => {
  // verify authorization.
  const auth = req.headers.authorization + '';
  const token = auth.split(' ').pop();
  const pubKey = await datastore.getPublishKey(token + '');

  if (!pubKey) {
    res.statusMessage = 'token not found';
    res.status(401);
    const ret = {error: '{"error":"publish key not found"}', statusCode: 401};
    res.end(ret.error);
    return ret;
  }

  if (pubKey.expiration && pubKey.expiration <= Date.now()) {
    res.statusMessage = 'token expired';
    res.status(401);
    const ret = {error: '{"error":"publish key expired"}', statusCode: 401};
    res.end(ret.error);
    return ret;
  }

  // get the client github user token with pubKey.username
  const user = await datastore.getUser(pubKey.username);
  if (!user) {
    res.status(401);
    const ret = {
      error: '{"error":"publish token unauthenticated"}',
      statusCode: 401
    };
    res.end(ret.error);
    return ret;
  }



  console.log(
      'attempting to publish package ' + packageName +
      ' with publish key config ' + pubKey.package);

  if (pubKey.package && pubKey.package !== packageName) {
    console.log('401. token cannot publish this package ' + packageName);
    res.statusMessage = 'token cannot publish this package';
    res.status(401);
    const ret = {
      error: formatError(`
            This token cannot publish npm package ${packageName} you\'ll need to
            npm login --registry https://wombat-dressing-room.appspot.com
            again to publish this package.
            `),
      statusCode: 401
    };
    res.end(ret.error);
    return ret;
  }

  // fetch existing packument
  console.log('fetching ', packageName, 'from npm');
  const doc = await packument(packageName);

  let latest = undefined;
  let newPackage = false;
  let drainedBody: false|Buffer = false;
  if (!doc) {
    // this is a completely new package.
    newPackage = true;
    drainedBody = await drainRequest(req);
    // set latest so we use the repository of the new package to verify github
    // permissions
    try {
      latest = JSON.parse(drainedBody + '') as Packument;
      latest = latest.versions[latest['dist-tags'].latest || ''];
      // not all packages have a latest dist-tag
    } catch (e) {
      console.log('got ' + e + ' parsing publish');
      res.status(401);
      const ret = {
        error: '{"error":"malformed json package document in publish"}',
        statusCode: 401
      };
      res.end('{"error":"malformed json package document in publish"}');
      return ret;
    }
    // if its the first publish of a scoped package you have to set the access
    // public flag in the document if it has an access flag already I use the
    // one sent by the user. this effectively defaults this proxy to the
    // opposite behavior to npm this entire feature can be left out as npm
    // requires that the user passes this value for first publish.
    /*
    if(packageName.indexOf('@') === 0 && !latest.access){
        latest.access = 'public'
        // update buffer
        drainedBody = Buffer.from(JSON.stringify(latest))
    }
    */
  } else {
    // the package already exists!
    latest = findLatest(doc);
  }

  if (!latest) {
    console.log('missing latest version for ' + packageName);
    // we need to verify that this package has a repo config that points to
    // github so users don't lock themselves out.
    res.status(500);
    const ret = {
      error: formatError(
          'not supported yet. package is rather strange. its not new and has no latest version'),
      statusCode: 500
    };
    res.end(ret.error);
    return ret;
  }


  if (!latest.repository) {
    console.log('missing repository in the latest version of ' + packageName);
    res.statusMessage = 'latest npm version missing github repository';
    res.statusCode = 400;

    const ret = {
      error: formatError(
          'in order to publish the latest version must have a repository ' +
          user.name + ' can access.'),
      statusCode: 400
    };
    res.end(ret.error);
    return ret;
  }

  console.log('latest repo ', latest.repository);

  const repo = repoToGithub(latest.repository);

  // make sure publish user has permission to publish the package
  // get the github repository from packument
  if (!repo) {
    res.status(400);
    const ret = {
      error: formatError(
          'in order to publish the latest version must have a repository on github'),
      statusCode: 400
    };
    res.end(ret.error);
    return ret;
  }

  let repoResp = null;
  try {
    repoResp = await github.getRepo(repo.name, user.token);
  } catch (e) {
    // res.status(400);
    const ret = {
      error: formatError(
          'respository ' + repo.url + ' doesnt exist or ' + user.name +
          ' doesnt have access'),
      statusCode: 400
    };
    res.end(ret.error);
    return ret;
  }

  if (!repoResp) {
    res.status(404);
    const ret = {
      error: formatError(
          'in order to publish the latest version must have a repository ' +
          user.name + ' can\'t see it'),
      statusCode: 404
    };
    res.end(ret.error);
    return ret;
  }

  console.log('repo response!', repoResp.permissions);

  if (!(repoResp.permissions.push || repoResp.permissions.admin)) {
    res.status(401);
    const ret = {
      error: formatError(
          user.name + ' cannot push repo ' + repo.url +
          '. push permission required to publish.'),
      statusCode: 401
    };
    res.end(ret.error);
    return ret;
  }

  // update auth information to be the publish user.
  req.headers.authorization = 'Bearer ' + config.npmToken;
  // send 2fa token.
  req.headers['npm-otp'] = totpCode(config.totpSecret);
  req.headers.host = 'registry.npmjs.org';
  const npmreq = request(
      'https://registry.npmjs.org' + req.url,
      {method: req.method, headers: req.headers});

  // if we've buffered the publish request already
  if (drainedBody) {
    npmreq.pipe(res);
    npmreq.write(drainedBody);
    // TODO: missing end here? make sure this path is covered.
  } else {
    req.pipe(npmreq).pipe(res);
  }

  req.on('error', (e: Error) => {
    console.log('oh how strange. request errored', e);
  });
  npmreq.on('error', (e: Error) => {
    console.log('npm request error ', e);
  });
  res.on('error', (e: Error) => {
    console.log('error sending response for npm publish', e);
  });

  return new Promise((resolve, reject) => {
    npmreq.on('response', async (npmres) => {
      resolve({statusCode: npmres.statusCode, newPackage});
    });
  });
};

app.put(/^\/[^\/]+$/, wrap(async (req, res) => {
          const plainPackageName = req.url.substr(1);
          const packageName = decodeURIComponent(plainPackageName);

          const result = await writePackage(packageName, req, res);
          if (result.newPackage && result.statusCode === 200) {
            try {
              const res = await require2fa(
                  packageName, config.npmToken, totpCode(config.totpSecret));
              console.log(
                  'enabled per package 2fa for ' + packageName + '? ',
                  res.status, res.data + '');
            } catch (e) {
              console.log(
                  'attempted to enable per package 2fa for ' + packageName +
                  ' but got error ' + e);
            }
          }
        }));
// PUT
// https://wombat-dressing-room.appspot.com/-/package/soldair-test-package/dist-tags/latest

app.put('/-/package/:package/dist-tags/:tag', wrap(async (req, res) => {
          const result = await writePackage(
              decodeURIComponent(req.params.package), req, res);
          // the request has not been ended yet if there has been a wombat
          // error.
          if (result.error) {
            console.log('create dist tag error ', req.url, result);
          } else {
            console.log('');
          }
        }));

app.post('/_/2fa', wrap(async (req, res) => {
           const packageName = req.query.packageName || '';
           let result: {status: number, data: Buffer}|undefined;
           try {
             result = await require2fa(
                 packageName, config.npmToken, totpCode(config.totpSecret));
           } catch (e) {
             return res.end(
                 '{"error":"server error setting required 2fa on package"}');
           }
           console.log(result.data + '');

           res.statusCode = result ? result.status : 500;
           if (res.statusCode === 200) {
             res.end('"ok"');
           } else {
             res.end('oh no');
           }
         }));

app.post('/-/package/:package/access', (req, res) => {
  console.log('hit');
  res.end('not supported');
});

app.post(
    '/-/v1/login', wrap(async (req, res) => {
      // serve a new token to the npm cli.
      // If they've provided an npmrcNamespace add it to the loginUrl as a
      // package name hint
      const packageNameHint = req.npmrcNamespace ?
          '&package=' + encodeURIComponent(req.npmrcNamespace.substr(1)) :
          '';
      const token =
          await datastore.saveHandoffKey(datastore.generatePublishKey());
      res.end(`{"doneUrl":"${config.userRegistryUrl}/_/done?ott=${
          token}","loginUrl":"${config.userLoginUrl}/_/token-settings?ott=${
          token}${packageNameHint}"}`);
    }));

app.get('/_/done', wrap(async (req, res) => {
          const parsed = url.parse(req.url, true);
          const query = parsed.query || {};

          const handoff = await datastore.getHandoffKey(query.ott + '');
          if (!handoff) {
            // to prevent the cli form falling back to couchdb auth we send a
            // 200 but no token. this leaves quite a bit to be desired as far as
            // messaging in the cli but prevents falling back to an interactive
            // login.
            res.status(200);
            res.header(
                'npm-notice', 'The one time token expired or is invalid.');
            res.end('{"token":""}');
          } else if (!handoff.complete) {
            res.header('retry-after', '3');
            res.status(202);
            res.end('{}');
          } else if (handoff.complete) {
            res.end(JSON.stringify({token: handoff.value}));
          }
        }));


// so you can fetch package documents from wombot if '?write=true' is in the
// query string. required for npm deprecate.
app.get('/_/metadata/:package', (req, res) => {
  console.log(
      'proxying write metadata request to npm for ', req.params.package);
  request('https://registry.npmjs.org/' + req.params.package).pipe(res);
});
// now just proxy anything thats a valid single chunk
app.get(/^\/[^/]+$/, (req, res, next) => {
  const pkg = decodeURIComponent(req.url.substr(1));
  console.log('proxying metadata request to npm for ', pkg);
  if (validatePackage(pkg).validForOldPackages) {
    request('https://registry.npmjs.org/' + req.url).pipe(res);
    return;
  }
  next();
});

// serve dist-tag list
app.get('/-/package/:package/dist-tags', (req, res) => {
  request('https://registry.npmjs.org' + req.url).pipe(res);
});

// for the moment we'll disallow dit tag putting.
// we need to fetch the packument and verify repo permissions just like publish.
app.put('/-/package/:package/dist-tags/:tag', (req, res) => {
  res.statusCode = 405;
  res.end('{}');
});

// web --------------------------------
app.use(cookieSession({
  name: 'session',
  keys: [config.sessionSecret || 'wombats are fun'],
}));

const redirectToLoginServer = (req: express.Request, res: express.Response) => {
  if (!config.loginEnabled) {
    if (req.query.redir) {
      res.end('login disabled and there is maybe a redirect loop.');
    } else if (config.userLoginUrl) {
      res.redirect(config.userLoginUrl + req.url);
    } else {
      res.end('these are not the droids you\'re looking for');
    }
    return true;
  }
  return false;
};


app.get('/', wrap(async (req, res) => {
          if (redirectToLoginServer(req, res)) {
            return;
          }

          res.header('Content-type', 'text/html');

          if (req.session!.token) {
            let page = indexHtml + '';
            page = page.replace('{username}', req.session!.user.login);
            res.end(page);

          } else {
            const {link, code} =
                github.webAccessLink(config.githubId, config.githubSecret, []);
            const page = loginPage.replace('{link}', link);
            res.end(page);
          }
        }));

app.post('/logout', (req, res) => {
  unsafe.clearSession(req);
  res.end('"ok"');
});

// gh-auth receive callback
app.get(
    '/oauth/github', wrap(async (req, res) => {
      // https://github.com/login/oauth/access_token
      if (!config.loginEnabled) {
        res.end('service disabled.');
      }

      if (!req.query || !req.query.code) {
        res.status(403);
        res.send('error processing login. <a href="/">try again</a>.');
        return;
      }

      try {
        const token = await github.webAccessToken(
            config.githubId, config.githubSecret, req.query.code);

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
    }));

app.get('/_/done', wrap(async (req, res) => {
          const parsed = url.parse(req.url, true);
          const query = parsed.query || {};

          const handoff = await datastore.getHandoffKey(query.ott + '');
          if (!handoff) {
            res.statusCode = 404;
            return res.end();
          }

          return;
        }));

app.get(
    '/_/token', wrap(async (req, res) => {
      if (redirectToLoginServer(req, res)) {
        return;
      }

      // TODO handle
      if (!req.session!.token) {
        req.session!.loginRedirect = req.url;
        // not logged in.
        return res.redirect('/');
      }

      let ttl = undefined;
      if (req.query.type === 'ttl') {
        ttl = Date.now() + ONE_DAY;
      } else if (!req.query.package || !req.query.package.trim().length) {
        res.statusCode = 400;
        return res.end('"package name required."');
      }

      const handoff = await datastore.getHandoffKey(req.query.ott + '');

      if (handoff) {
        await Promise.all([
          datastore.savePublishKey(
              req.session!.user.login, handoff.value,
              req.query.package ? (req.query.package + '').trim() : undefined,
              ttl),
          datastore.completeHandoffKey(req.query.ott + '')
        ]);
        res.header('content-type', 'text/html');
        res.end('token created!.<br/><a href="/">Manage Account</>');
      } else {
        res.statusCode = 404;
        res.end('failed to login. run npm login again.');
      }
    }));

app.get('/_/token-settings', wrap(async (req, res) => {
          if (redirectToLoginServer(req, res)) {
            return;
          }

          res.header('content-type', 'text/html');
          res.end(tokenSettingsPage);
        }));

app.get('/_/manage-tokens', wrap(async (req, res) => {
          if (redirectToLoginServer(req, res)) {
            return;
          }

          // redirect to index is not logged in. connect with github flow works
          // there.
          if (!req.session!.token) {
            res.statusCode = 302;
            res.header('location', '/');
            res.end();
            return;
          }

          let page = manageTokensPage + '';
          page = page.replace('{username}', req.session!.user.login);

          res.header('content-type', 'text/html');
          res.end(page);
        }));

app.get('/_/api/v1/tokens', (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }

  datastore.getPublishKeys(req.session!.user.login)
      .then((keys) => {
        // CANNOT SEND REAL KEY TO THE FRONTEND.
        const cleaned: Array<{
          created: number,
          prefix: string,
          package?: string,
          expiration?: number
        }> = [];
        keys.forEach((row) => {
          cleaned.push({
            created: row.created,
            prefix: row.value.substr(0, 5),
            package: row.package,
            expiration: row.expiration
          });
        });

        res.end(JSON.stringify({error: false, data: cleaned}));
      })
      .catch((e) => {
        const code = uuid.v4();
        console.log(
            'error loading user tokens list ' + req.session!.user.login +
            ' error:\n' + e);
        res.end(JSON.stringify({
          error: 'error loading tokens. contact support with code ' + code
        }));
      });
});

app.delete('/_/api/v1/token', async (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }

  if (avoidCSRF(req, res)) {
    return;
  }

  const result = await drainRequest(req) + '';
  const body = json(result);

  if (!body) {
    return res.end(JSON.stringify({error: 'malformed json request body'}));
  }

  const prefix = body.prefix || '';
  const created = (body.created || 0);

  if (!prefix || !created) {
    return res.end(JSON.stringify(
        {error: 'missing token prefix or created in json request body'}));
  }

  datastore.getObfuscatedPublishKey(req.session!.user.login, created, prefix)
      .then(async (key) => {
        let error;
        if (key) {
          await datastore.deletePublishKey(key.value);
        } else {
          error = 'couldn\'t find key';
        }

        res.end(JSON.stringify({error, data: !!key}));
      })
      .catch((e) => {
        const code = uuid.v4();
        console.log(
            'error deleting token ' + req.session!.user.login + ' error:\n' +
            e);
        res.end(JSON.stringify({
          error: 'error loading tokens. contact support with code ' + code
        }));
      });
});

app.put('/_/api/v1/token', async (req, res) => {
  if (redirectToLoginServer(req, res)) {
    return;
  }

  if (avoidCSRF(req, res)) {
    return;
  }

  const result = await drainRequest(req) + '';
  const body = json(result);

  if (!body) {
    return res.end(JSON.stringify({error: 'malformed json request body'}));
  }

  const packageName = body.package;

  if (!packageName || !(packageName + '').trim().length) {
    return res.end(
        JSON.stringify({error: 'missing package key in request body'}));
  }

  console.log(
      'AUDIT', new Date().toJSON(), 'user', req.session!.user.login,
      'creating publish token for', packageName);


  const packages = packageName.split('\n');
  const saves = packages.map((name: string) => {
    const key = uuid.v4();
    const saveResult =
        datastore.savePublishKey(req.session!.user.login, key, name + '');
    return saveResult.then(() => {
      return {token: key, package: name};
    });
  });

  try {
    const result = await Promise.all(saves);
    console.log('api create token. save result.', result);
    res.end(JSON.stringify({data: result}));
  } catch (e) {
    const id = uuid.v4();
    console.log('ERROR saing new keys : id:' + id, e + '');
    res.end(JSON.stringify({error: 'error saving new keys. id ' + id}));
  }
});



// the npm client will print non json errors to the screen in publish.
// this is a really great way to give detailed error messages
const formatError = (message: string) => {
  return `
===============================
Publish service error
-------------------------------
${message}
===============================
`;
};

const drainRequest = (req: express.Request): Promise<Buffer >=> {
  return new Promise((resolve, reject) => {
    const buf: Buffer[] = [];
    req.on('data', (b: Buffer) => {
      buf.push(b);
    });
    req.on('end', () => {
      resolve(Buffer.concat(buf));
    });
    req.on('error', (e) => {
      reject(e);
    });
  });
};

type Handler = (req: express.Request, res: express.Response) =>
    Promise<void>|void;

function wrap(a: Handler) {
  return (req: express.Request, res: express.Response) => {
    const p = a(req, res);
    if (p) {
      p.catch((e) => {
        const id = uuid.v4().replace(/[-]+/g, '');
        console.error(
            'unhandled request handler rejection. ' + id + ' ' +
            JSON.stringify(e + e.stack));
        res.status(500);
        res.end('server error ping support with id: ' + id);
      });
    }
  };
}

function avoidCSRF(req: express.Request, res: express.Response) {
  const origin = req.headers.referer || req.headers.origin;
  // light CSRF check.
  if (origin && origin.indexOf(process.env.LOGIN_URL || '') !== 0) {
    const logid = uuid.v4();
    console.log('token service csrf error ' + logid, req.headers);
    res.statusCode = 400;
    res.end(JSON.stringify({
      'error':
          'please refresh the page and try your request again. support id: ' +
          logid
    }));
    return true;
  }
  return false;
}

app.listen(process.env.PORT || 8080);
