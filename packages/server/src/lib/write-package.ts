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
import {User} from './datastore';

export interface WriteResponse {
  statusCode: number;
  error?: string;
  newPackage?: boolean;
}

/**
 * Handles the publication of an npm package by acting as a validating proxy.
 *
 * This function performs several critical steps before allowing a package to be published to npm:
 * 1.  **Authorization**: Verifies the provided publish key against the datastore and checks for expiration.
 * 3.  **Package Validation (Optional)**: Ensures the publication is authorized for the specific package name
 *     associated with the publish key (if enabled in the publish key).
 * 4.  **Repository Permission Check**: Fetches the package's metadata (packument) and validates that the
 *     user has 'push' or 'admin' access to the GitHub repository specified in the package.json.
 *     It validates both the current 'latest' version and the incoming version in the request.
 * 5.  **GitHub Release 2FA (Optional)**: If enabled in the publish key, verifies that the version being published matches
 *     a corresponding release or tag on GitHub.
 * 6.  **Proxying**: If all checks pass, it proxies the original publication request to the official
 *     npm registry with the necessary credentials and OTP.
 *
 * @param packageName - The name of the npm package being published.
 * @param req - The Express request object containing the publication payload and authorization headers.
 * @param res - The Express response object used to send status and error messages back to the npm client.
 * @returns A promise that resolves to a WriteResponse indicating the outcome of the publication attempt.
 */
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
    'attempting to publish package ' + packageName + ' with publish key config:'
  );
  console.info(
    'package',
    pubKey.package,
    'releaseAs2FA',
    pubKey.releaseAs2FA,
    'username',
    pubKey.username,
    'monorepo',
    pubKey.monorepo
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
  let docFromNpm = await packument(packageName);

  let latest = undefined;

  let newPackage = false;
  let drainedBody: false | Buffer = false;
  if (!docFromNpm || docFromNpm?.time?.unpublished) {
    // this is a completely new package.
    newPackage = true;
    drainedBody = await drainRequest(req);
    // set latest so we use the repository of the new package to verify github
    // permissions
    try {
      docFromNpm = JSON.parse(drainedBody + '') as Packument;
      latest = docFromNpm.versions[
        docFromNpm['dist-tags'].latest || ''
      ] as PackumentVersionWombat;
      // not all packages have a latest dist-tag
    } catch (e) {
      console.info('got ' + e + ' parsing publish');
      const msg = 'malformed json package document in publish a new package';
      return respondWithError(res, msg, 400);
    }
  } else {
    // the package already exists!
    latest = findLatest(docFromNpm);
  }

  if (!latest) {
    console.info('missing latest version for ' + packageName);
    // we need to verify that this package has a repo config that points to
    // github so users don't lock themselves out.
    const msg =
      'not supported yet. package is rather strange. its not new and has no latest version';
    return respondWithError(res, msg, 500);
  }

  // A set of repositories to confirm users' "push" permissions.
  // This is not just the latest version but also incoming package.json
  // to avoid a bad repository value to be published (and cannot be updated).
  const reposToCheck = new Set<string>();

  // helper to add repository to check list
  const addRepo = (v: PackumentVersionWombat) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repoInfo = repoToGithub(v.permsRepo ?? v.repository);
    if (repoInfo) {
      reposToCheck.add(repoInfo.name);
    }
  };
  // check the repository of the latest version and upcoming package.json
  addRepo(latest);

  drainedBody = drainedBody || (await drainRequest(req));
  const drainedBodyString = drainedBody + '';
  try {
    const incomingDoc = JSON.parse(drainedBodyString) as Packument;

    // The document in the "npm publish" request body only has one
    // key-value entry in the "versions" field.
    // With "--no-tag" option in "npm publish", it does not have the
    // "latest" tag in the "dist-tag" field of the document.
    for (const incomingPackage of Object.values(incomingDoc.versions)) {
      const incomingLatest = incomingPackage as PackumentVersionWombat;
      if (
        !incomingLatest ||
        (!incomingLatest.repository && !incomingLatest.permsRepo)
      ) {
        // drainedBodyString includes the tarball attachemnt. Don't print all.
        console.info(
          'incoming package.json is missing repository (or permsRepo) field',
          drainedBodyString.slice(0, 1000)
        );
        const msg =
          'in order to publish, the package.json must have a repository (or permsRepo) field.';
        return respondWithError(res, msg, 400);
      }
      addRepo(incomingLatest);
    }
  } catch (e) {
    // drainedBodyString includes the tarball attachemnt. Don't print all.
    console.info(
      'got ' + e + ' parsing publish. The request body:',
      drainedBodyString.slice(0, 1000)
    );
    const msg = 'malformed json package document in the request';
    return respondWithError(res, msg, 400);
  }

  if (reposToCheck.size === 0) {
    // For operations that are outside package publications, reposToCheck
    // has only one item (the latest from NPM).
    // drainedBodyString includes the tarball attachemnt. Don't print all.
    console.info(
      'missing repositories to check for ' + packageName,
      'The request body:',
      drainedBodyString.slice(0, 1000)
    );
    const msg =
      'in order to publish the latest version must have package.json with a repository.';
    return respondWithError(res, msg, 400);
  }

  for (const repoName of reposToCheck) {
    try {
      await enforceRepositoryPermission(repoName, user);
    } catch (_e) {
      const e = _e as {statusMessage: string; statusCode: number};
      return respondWithError(res, e.statusMessage, e.statusCode);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = repoToGithub(latest.permsRepo ?? latest.repository);

  // If the publication key has been configured with GitHub releases as a
  // second factor of authentication, we verify that the version being published
  // in the new packument aligns with the latest release created on GitHub:
  if (pubKey.releaseAs2FA && repo) {
    console.info('token uses releases as 2FA');
    drainedBody = drainedBody || (await drainRequest(req));
    try {
      await enforceMatchingRelease(
        repo.name,
        user.token,
        newPackage ? undefined : docFromNpm,
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
 * Throws an exception if the user does not have "push" permission
 * to the repository.
 */
async function enforceRepositoryPermission(repoName: string, user: User) {
  let repoResp = null;
  repoResp = await github.getRepo(repoName, user.token);

  if (!repoResp) {
    const msg = `in order to publish the latest version must have a repository ${user.name} can't see it`;
    throw new WombatServerError(msg, 400);
  }
  console.info(repoName, ': response!', repoResp.permissions);

  if (!(repoResp.permissions.push || repoResp.permissions.admin)) {
    const msg = `${user.name} cannot push repo https://github.com/${repoName}. push permission required to publish.`;
    throw new WombatServerError(msg, 400);
  }
}

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
  } catch (err) {
    if (err instanceof WombatServerError) {
      throw err;
    }
    if (err instanceof Error) {
      throw new WombatServerError(err.message || 'unknown error', 500);
    }
    throw new WombatServerError('unknown error', 500);
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
