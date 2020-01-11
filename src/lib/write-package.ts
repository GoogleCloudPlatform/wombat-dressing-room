import {Packument} from '@npm/types';
import {Request, Response} from 'express';
import * as request from 'request';

import {config} from '../lib/config';
import {drainRequest} from '../lib/drain-request';
import * as github from '../lib/github';
import {totpCode} from '../lib/totp-code';

import * as datastore from './datastore';
import {newVersions} from './new-versions';
import {findLatest, packument, repoToGithub} from './packument';
import {WombatServerError} from './wombat-server-error';

export interface WriteResponse {
  statusCode: number;
  error?: string;
  newPackage?: boolean;
}

export const writePackage = async (
  packageName: string,
  req: Request,
  res: Response
): Promise<WriteResponse> => {
  // verify authorization.
  const auth = req.headers.authorization + '';
  const token = auth.split(' ').pop();
  const pubKey = await writePackage.datastore.getPublishKey(token + '');

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
  const user = await writePackage.datastore.getUser(pubKey.username);
  if (!user) {
    res.status(401);
    const ret = {
      error: '{"error":"publish token unauthenticated"}',
      statusCode: 401,
    };
    res.end(ret.error);
    return ret;
  }

  console.info(
    'attempting to publish package ' +
      packageName +
      ' with publish key config ' +
      pubKey.package
  );

  if (pubKey.package && pubKey.package !== packageName) {
    console.info('401. token cannot publish this package ' + packageName);
    res.statusMessage = 'token cannot publish this package';
    res.status(401);
    const ret = {
      error: formatError(`
            This token cannot publish npm package ${packageName} you\'ll need to
            npm login --registry https://wombat-dressing-room.appspot.com
            again to publish this package.
            `),
      statusCode: 401,
    };
    res.end(ret.error);
    return ret;
  }

  // fetch existing packument
  console.info('fetching ', packageName, 'from npm');
  let doc = await packument(packageName);

  let latest = undefined;
  let newPackage = false;
  let drainedBody: false | Buffer = false;
  if (!doc) {
    // this is a completely new package.
    newPackage = true;
    drainedBody = await drainRequest(req);
    // set latest so we use the repository of the new package to verify github
    // permissions
    try {
      doc = JSON.parse(drainedBody + '') as Packument;
      latest = doc.versions[doc['dist-tags'].latest || ''];
      // not all packages have a latest dist-tag
    } catch (e) {
      console.info('got ' + e + ' parsing publish');
      res.status(401);
      const ret = {
        error: '{"error":"malformed json package document in publish"}',
        statusCode: 401,
      };
      res.end('{"error":"malformed json package document in publish"}');
      return ret;
    }
  } else {
    // the package already exists!
    latest = findLatest(doc);
  }

  if (!latest) {
    console.info('missing latest version for ' + packageName);
    // we need to verify that this package has a repo config that points to
    // github so users don't lock themselves out.
    res.status(500);
    const ret = {
      error: formatError(
        'not supported yet. package is rather strange. its not new and has no latest version'
      ),
      statusCode: 500,
    };
    res.end(ret.error);
    return ret;
  }

  if (!latest.repository) {
    console.info('missing repository in the latest version of ' + packageName);
    res.statusMessage = 'latest npm version missing github repository';
    res.statusCode = 400;

    const ret = {
      error: formatError(
        'in order to publish the latest version must have a repository ' +
          user.name +
          ' can access.'
      ),
      statusCode: 400,
    };
    res.end(ret.error);
    return ret;
  }

  console.info('latest repo ', latest.repository);

  const repo = repoToGithub(latest.repository);

  // make sure publish user has permission to publish the package
  // get the github repository from packument
  if (!repo) {
    res.status(400);
    const ret = {
      error: formatError(
        'in order to publish the latest version must have a repository on github'
      ),
      statusCode: 400,
    };
    res.end(ret.error);
    return ret;
  }

  let repoResp = null;
  try {
    repoResp = await github.getRepo(repo.name, user.token);
  } catch (e) {
    const ret = {
      error: formatError(
        'respository ' +
          repo.url +
          ' doesnt exist or ' +
          user.name +
          ' doesnt have access'
      ),
      statusCode: 400,
    };
    res.end(ret.error);
    return ret;
  }

  if (!repoResp) {
    res.status(404);
    const ret = {
      error: formatError(
        'in order to publish the latest version must have a repository ' +
          user.name +
          " can't see it"
      ),
      statusCode: 404,
    };
    res.end(ret.error);
    return ret;
  }

  console.info('repo response!', repoResp.permissions);

  if (!(repoResp.permissions.push || repoResp.permissions.admin)) {
    res.status(401);
    const ret = {
      error: formatError(
        user.name +
          ' cannot push repo ' +
          repo.url +
          '. push permission required to publish.'
      ),
      statusCode: 401,
    };
    res.end(ret.error);
    return ret;
  }

  // If the publication key has been configured with GitHub releases as a
  // second factor of authentication, we verify that the version being published
  // in the new packument aligns with the latest release created on GitHub:
  if (pubKey.releaseAs2FA) {
    console.info('token uses releases as 2FA');
    drainedBody = drainedBody || (await drainRequest(req));
    try {
      await enforceMatchingRelease(
        repo.name,
        user.token,
        newPackage ? undefined : doc,
        drainedBody,
        req,
        res
      );
    } catch (e) {
      res.statusCode = e.statusCode;
      res.statusMessage = e.statusMessage;
      const ret = {
        error: JSON.stringify({error: e.statusMessage}),
        statusCode: e.statusCode,
      };
      res.end(ret.error);
      return ret;
    }
  }

  return writePackage.pipeToNpm(req, res, drainedBody, newPackage);
};

writePackage.pipeToNpm = (
  req: Request,
  res: Response,
  drainedBody: false | Buffer,
  newPackage: boolean
): Promise<WriteResponse> => {
  // update auth information to be the publish user.
  req.headers.authorization = 'Bearer ' + config.npmToken;
  // send 2fa token.
  req.headers['npm-otp'] = totpCode(config.totpSecret);
  req.headers.host = 'registry.npmjs.org';
  const npmreq = request('https://registry.npmjs.org' + req.url, {
    method: req.method,
    headers: req.headers,
  });

  // if we've buffered the publish request already
  if (drainedBody) {
    npmreq.pipe(res);
    npmreq.write(drainedBody);
    // TODO: missing end here? make sure this path is covered.
  } else {
    req.pipe(npmreq).pipe(res);
  }

  req.on('error', (e: Error) => {
    console.info('oh how strange. request errored', e);
  });
  npmreq.on('error', (e: Error) => {
    console.info('npm request error ', e);
  });
  res.on('error', (e: Error) => {
    console.info('error sending response for npm publish', e);
  });

  return new Promise((resolve, reject) => {
    npmreq.on('response', async npmres => {
      resolve({statusCode: npmres.statusCode, newPackage});
    });
  });
};

/*
 * Throws an exception if a matching GitHub release cannot be found for the
 * packument that is being published to npm.
 */
async function enforceMatchingRelease(
  repoName: string,
  token: string,
  lastPackument: Packument | undefined,
  drainedBody: Buffer,
  req: Request,
  res: Response
) {
  try {
    const newPackument = JSON.parse(drainedBody + '') as Packument;
    // Some types of updates don't include a full packument, e.g., changing
    // a dist-tag:
    if (!newPackument['dist-tags']) {
      throw new WombatServerError(
        'Release-backed tokens should be used exclusively for publication.',
        400
      );
    }

    let newVersion =
      newPackument.versions[newPackument['dist-tags'].latest || ''].version;
    // If this is not the first package publication, we infer the version being
    // published by comparing the new and old packument:
    if (lastPackument) {
      console.info(
        `${newPackument.name} has been published before, comparing versions`
      );
      const versions = newVersions(lastPackument, newPackument);
      if (versions.length !== 1) {
        throw new WombatServerError(
          'No new versions found in packument. Release-backed tokens should be used exclusively for publication.',
          400
        );
      } else {
        newVersion = versions[0];
      }
    }
    const latestRelease = await github.getLatestRelease(repoName, token);
    if (latestRelease !== `v${newVersion}`) {
      console.info(
        `latestRelease = ${latestRelease} newVersion = ${newVersion}`
      );
      const msg = `matching release v${newVersion} not found for ${repoName}`;
      throw new WombatServerError(msg, 400);
    }
  } catch (err) {
    if (err.statusCode && err.statusMessage) throw err;
    err.statusCode = 500;
    err.statusMessage = 'unknown error';
    throw err;
  }
}

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

writePackage.datastore = datastore;
