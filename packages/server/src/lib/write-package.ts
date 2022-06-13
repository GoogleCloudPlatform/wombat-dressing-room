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

import {Packument} from '@npm/types';
import {Request, Response} from 'express';
import * as request from 'request';

import {config} from '../lib/config';
import {drainRequest} from '../lib/drain-request';
import * as github from '../lib/github';
import {totpCode} from '../lib/totp-code';

import * as datastore from './datastore';
import {newVersions} from './new-versions';
import {
  findLatest,
  packument,
  repoToGithub,
  PackumentVersionWombat,
} from './packument';
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
    return respondWithError(res, 'publish key not found', 401);
  }

  if (pubKey.expiration && pubKey.expiration <= Date.now()) {
    return respondWithError(res, 'publish key expired', 401);
  }

  // get the client github user token with pubKey.username
  const user = await writePackage.datastore.getUser(pubKey.username);
  if (!user) {
    return respondWithError(res, 'publish token unauthenticated', 401);
  }

  console.info(
    'attempting to publish package ' +
      packageName +
      ' with publish key config ' +
      pubKey.package
  );

  if (pubKey.package && pubKey.package !== packageName) {
    console.info('401. token cannot publish this package ' + packageName);
    const msg = `
    This token cannot publish npm package ${packageName} you'll need to
    npm login --registry ${config.userRegistryUrl}
    again to publish this package.
    `;
    return respondWithError(res, msg, 401);
  }

  // fetch existing packument
  console.info('fetching ', packageName, 'from npm');
  let doc = await packument(packageName);

  let latest = undefined;

  let newPackage = false;
  let drainedBody: false | Buffer = false;
  if (!doc || doc?.time?.unpublished) {
    // this is a completely new package.
    newPackage = true;
    drainedBody = await drainRequest(req);
    // set latest so we use the repository of the new package to verify github
    // permissions
    try {
      doc = JSON.parse(drainedBody + '') as Packument;
      latest = doc.versions[
        doc['dist-tags'].latest || ''
      ] as PackumentVersionWombat;
      // not all packages have a latest dist-tag
    } catch (e) {
      console.info('got ' + e + ' parsing publish');
      const msg = 'malformed json package document in publish';
      return respondWithError(res, msg, 400);
    }
  } else {
    // the package already exists!
    latest = findLatest(doc);
  }

  if (!latest) {
    console.info('missing latest version for ' + packageName);
    // we need to verify that this package has a repo config that points to
    // github so users don't lock themselves out.
    const msg =
      'not supported yet. package is rather strange. its not new and has no latest version';
    return respondWithError(res, msg, 500);
  }

  if (!latest.repository && !latest.permsRepo) {
    console.info('missing repository in the latest version of ' + packageName);
    const msg = `in order to publish the latest version must have a repository ${user.name} can access.`;
    return respondWithError(res, msg, 400);
  }

  console.info('latest repo ', latest.permsRepo ?? latest.repository);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = repoToGithub(latest.permsRepo ?? latest.repository);

  // make sure publish user has permission to publish the package
  // get the github repository from packument
  if (!repo) {
    console.info(
      'failed to find repository in latest.repository or latest.permsRepo field.'
    );
    const msg =
      'In order to publish through wombat the latest version on npm must have a repository pointing to github';
    return respondWithError(res, msg, 400);
  }

  let repoResp = null;
  try {
    repoResp = await github.getRepo(repo.name, user.token);
  } catch (e) {
    console.info('failed to get repo response for ' + repo.name + ' ' + e);
    const msg = `repository ${repo.url} doesn't exist or ${user.name} doesn't have access.`;
    return respondWithError(res, msg, 400);
  }

  if (!repoResp) {
    const msg = `in order to publish the latest version must have a repository ${user.name} can't see it`;
    return respondWithError(res, msg, 400);
  }

  console.info('repo response!', repoResp.permissions);

  if (!(repoResp.permissions.push || repoResp.permissions.admin)) {
    const msg = `${user.name} cannot push repo ${repo.url}. push permission required to publish.`;
    return respondWithError(res, msg, 400);
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
        pubKey.monorepo
      );
    } catch (_e) {
      const e = _e as {statusMessage: string; statusCode: number};
      return respondWithError(res, e.statusMessage, e.statusCode);
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

  return new Promise(resolve => {
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
  monorepo?: boolean
) {
  try {
    const maybePackument = JSON.parse(drainedBody + '');
    if (
      typeof maybePackument !== 'object' ||
      maybePackument['dist-tags'] === undefined
    ) {
      throw new WombatServerError(
        'Release-backed tokens should be used exclusively for publication.',
        400
      );
    }
    // Check whether the publish document contains either a
    // "latest" or "next" tag:
    const newPackument = maybePackument as Packument;
    let newVersionPackument =
      newPackument.versions[newPackument['dist-tags'].latest || ''];
    if (!newVersionPackument) {
      newVersionPackument =
        newPackument.versions[newPackument['dist-tags'].next || ''];
    }
    if (!newVersionPackument) {
      throw new WombatServerError(
        'No "latest" or "next" version found in packument.',
        400
      );
    }
    let newVersion = newVersionPackument.version;

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
    let prefix;
    const tags = [];
    if (monorepo) {
      const splitName = newPackument.name.split('/');
      prefix = splitName.length === 1 ? splitName[0] : splitName[1];
      // release-please-style monorepo tags: package-v2.0.1
      tags.push(`${prefix}-v${newVersion}`);
      // lerna-style monorepo tags: @scope/package@2.0.1
      tags.push(`${newPackument.name}@${newVersion}`);
    } else {
      tags.push(`v${newVersion}`);
    }
    const release = await github.getRelease(repoName, token, tags);
    if (!release) {
      const msg = `matching release v${newVersion} not found for ${repoName}. Did not find any tags matching: ${tags.join()}`;
      throw new WombatServerError(msg, 400);
    }
  } catch (_err) {
    const err = _err as {statusMessage: string; statusCode: number};
    if (err.statusCode && err.statusMessage) throw err;
    err.statusCode = 500;
    err.statusMessage = 'unknown error';
    throw err;
  }
}

function respondWithError(res: Response, message: string, code = 400) {
  res.status(code || 401);
  const ret = {
    error: formatError(message),
    statusCode: code,
  };
  res.json(ret);
  return ret;
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
