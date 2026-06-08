import {Request, Response} from 'express';
import {Packument} from '@npm/types';
import * as datastore from './datastore';
import {PublishKey, User} from './datastore';
import * as github from './github';
import {drainRequest} from './drain-request';
import {
  findLatest,
  packument,
  repoToGithub,
  PackumentVersionWombat,
} from './packument';
import {newVersions} from './new-versions';
import {WombatServerError} from './wombat-server-error';
import {config} from './config';

interface GithubRepository {
  name: string;
  url: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  pubKey?: PublishKey;
  user?: User;
  docFromNpm?: Packument;
  repo?: GithubRepository;
  newPackage?: boolean;
  drainedBody?: false | Buffer;
  error?: string;
  statusCode?: number;
}

export function respondWithError(res: Response, message: string, code = 400) {
  res.status(code || 401);
  const ret = {
    error: formatError(message),
    statusCode: code,
  };
  res.json(ret);
  return ret;
}

const formatError = (message: string) => {
  return `
  ===============================
  Publish service error
  -------------------------------
  ${message}
  ===============================
  `;
};

export async function authorizeNpmAction(
  packageName: string,
  req: Request,
  res: Response,
  targetVersion?: string,
  datastoreOverride = datastore
): Promise<AuthorizationResult> {
  const auth = req.headers.authorization + '';
  const token = auth.split(' ').pop();
  const pubKey = await datastoreOverride.getPublishKey(token + '');

  if (!pubKey) {
    return {
      authorized: false,
      ...respondWithError(res, 'publish key not found', 401),
    };
  }

  if (pubKey.expiration && pubKey.expiration <= Date.now()) {
    return {
      authorized: false,
      ...respondWithError(res, 'publish key expired', 401),
    };
  }

  const user = await datastoreOverride.getUser(pubKey.username);
  if (!user) {
    return {
      authorized: false,
      ...respondWithError(res, 'publish token unauthenticated', 401),
    };
  }

  console.info(
    'attempting to authorize ' + packageName + ' with publish key config:'
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
    return {authorized: false, ...respondWithError(res, msg, 401)};
  }

  console.info('fetching ', packageName, 'from npm');
  let doc = await packument(packageName);

  let latest = undefined;
  let newPackage = false;
  let drainedBody: false | Buffer = false;

  if (!doc || doc?.time?.unpublished) {
    newPackage = true;
    drainedBody = await drainRequest(req);
    try {
      doc = JSON.parse(drainedBody + '') as Packument;
      latest = doc.versions[
        doc['dist-tags'].latest || ''
      ] as PackumentVersionWombat;
    } catch (e) {
      console.info('got ' + e + ' parsing publish');
      const msg = 'malformed json package document in publish a new package';
      return {authorized: false, ...respondWithError(res, msg, 400)};
    }
  } else {
    latest = findLatest(doc);
  }

  if (!latest) {
    console.info('missing latest version for ' + packageName);
    const msg =
      'not supported yet. package is rather strange. its not new and has no latest version';
    return {authorized: false, ...respondWithError(res, msg, 500)};
  }

  const reposToCheck = new Set<string>();
  const addRepo = (v: PackumentVersionWombat) => {
    const repoInfo = repoToGithub(v.permsRepo ?? v.repository);
    if (repoInfo) {
      reposToCheck.add(repoInfo.name);
    }
  };
  addRepo(latest);

  if (!targetVersion) {
    drainedBody = drainedBody || (await drainRequest(req));
    try {
      for (const repoName of getReposFromIncomingBody(drainedBody)) {
        reposToCheck.add(repoName);
      }
    } catch (e) {
      if (e instanceof WombatServerError) {
        return {authorized: false, ...respondWithError(res, e.message, e.statusCode)};
      }
      throw e;
    }
  }

  if (reposToCheck.size === 0) {
    console.info(
      'missing repositories to check for ' + packageName,
      'The request body:',
      (drainedBody + '').slice(0, 1000)
    );
    const msg =
      'in order to publish the latest version must have package.json with a repository.';
    return {authorized: false, ...respondWithError(res, msg, 400)};
  }

  for (const repoName of reposToCheck) {
    try {
      await enforceRepositoryPermission(repoName, user);
    } catch (_e) {
      const e = _e as {message: string; statusCode: number};
      return {authorized: false, ...respondWithError(res, e.message, e.statusCode)};
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repo = repoToGithub(latest.permsRepo ?? latest.repository);

  if (pubKey.releaseAs2FA && repo) {
    console.info('token uses releases as 2FA');

    if (!targetVersion && !drainedBody) {
      drainedBody = await drainRequest(req);
    }

    try {
      await enforceMatchingRelease(
        repo.name,
        user.token,
        newPackage ? undefined : doc,
        drainedBody,
        pubKey.monorepo,
        targetVersion
      );
    } catch (_e) {
      const e = _e as {
        statusMessage: string;
        statusCode: number;
        message?: string;
      };
      return {
        authorized: false,
        ...respondWithError(
          res,
          e.statusMessage || e.message || 'unknown error',
          e.statusCode
        ),
      };
    }
  }

  return {
    authorized: true,
    pubKey,
    user,
    docFromNpm: doc,
    repo: repo || undefined,
    newPackage,
    drainedBody,
  };
}

/**
 * Returns the repository names found in the incoming Packument body.
 */
function getReposFromIncomingBody(body: Buffer): Set<string> {
  const bodyString = body + '';
  const repos = new Set<string>();
  if (!bodyString) {
    return repos;
  }

  try {
    const doc = JSON.parse(bodyString) as Packument;

    if (doc && typeof doc === 'object' && doc.versions) {
      for (const version of Object.values(doc.versions)) {
        const v = version as PackumentVersionWombat;
        if (!v || (!v.repository && !v.permsRepo)) {
          console.info(
            'incoming package.json is missing repository (or permsRepo) field',
            bodyString.slice(0, 1000)
          );
          const msg =
            'in order to publish, the package.json must have a repository (or permsRepo) field.';
          throw new WombatServerError(msg, 400);
        }
        const repoInfo = repoToGithub(v.permsRepo ?? v.repository);
        if (repoInfo) {
          repos.add(repoInfo.name);
        }
      }
    }
  } catch (e) {
    if (e instanceof WombatServerError) {
      throw e;
    }
    console.info(
      'got ' + e + ' parsing publish. The request body:',
      bodyString.slice(0, 1000)
    );
    console.info(e);
    const msg = 'malformed json package document in the request';
    throw new WombatServerError(msg, 400);
  }

  return repos;
}

/**
 * Throws an exception if the user does not have "push" permission
 * to the repository.
 */
async function enforceRepositoryPermission(repoName: string, user: User) {
  let repoResp = null;
  try {
    repoResp = await github.getRepo(repoName, user.token);
  } catch (e) {
    console.info('failed to get repo response for ' + repoName + ' ' + e);
    throw new WombatServerError(
      `repository https://github.com/${repoName} doesn't exist or ${user.name} doesn't have access.`,
      400
    );
  }

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

export async function enforceMatchingRelease(
  repoName: string,
  token: string,
  lastPackument: Packument | undefined,
  drainedBody: Buffer | false,
  monorerepo?: boolean,
  targetVersion?: string
) {
  try {
    let newVersion = targetVersion;
    let newPackumentName = lastPackument ? lastPackument.name : '';

    if (!newVersion && drainedBody) {
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
      const newPackument = maybePackument as Packument;
      newPackumentName = newPackument.name;

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
      } else {
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
        newVersion = newVersionPackument.version;
      }
    }

    if (!newVersion) {
      throw new WombatServerError(
        'Could not determine target version for release verification.',
        400
      );
    }

    let prefix;
    const tags = [];
    if (monorerepo) {
      const splitName = newPackumentName.split('/');
      prefix = splitName.length === 1 ? splitName[0] : splitName[1];
      tags.push(`${prefix}-v${newVersion}`);
      tags.push(`${newPackumentName}@${newVersion}`);
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
