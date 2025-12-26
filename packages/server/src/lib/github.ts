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

import {URL} from 'url';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gh = require('octonode');

let clientOptions: {} | undefined;

/**
 * https://developer.github.com/v3/repos/#get
 * @param name repository name including username. ex: node/node or bcoe/yargs
 * @param token
 *
 * @returns GhUser
 */
export const getRepo = (name: string, token: string): Promise<GhRepo> => {
  return new Promise((resolve, reject) => {
    const client = gh.client(token, clientOptions);

    client.get('/repos/' + name, (err: Error, status: number, data: GhRepo) => {
      // bubbling this up as a unique error because its useful for folks to know
      // that the repo might not exist.
      if (status === 404) {
        return reject(new Error('repository ' + name + ' doesnt exist'));
      }

      if (err || status !== 200) {
        err =
          err ||
          new Error(
            'status ' + status + ' returned from github accessing ' + name
          );
        reject(err);
      }
      resolve(data);
    });
  });
};

/**
 * Checks if there is a matching release on GitHub for the given tag(s). If there is no release, we'll check the list of tags.
 * Checking tags is less reliable as a limited number of tags are checked and they are not in chronological order.
 * @param name repository name including username. ex: node/node or bcoe/yargs
 * @param token
 * @param tags list of possible tag names to fetch. The first one to match will be returned.
 *
 * @returns string first given tag that matches a tag or release on GitHub, or undefined if none match.
 */
export const getRelease = async (
  name: string,
  token: string,
  tags: string[]
): Promise<string | undefined> => {
  try {
    const matchingRelease = await getReleaseForTags(name, token, tags);
    if (matchingRelease) {
      return matchingRelease;
    }
  } catch (err) {
    // Fall back to checking for matching tags instead of throwing the error.
    console.error(
      `Error while checking releases: ${err}. Checking tags instead.`
    );
  }
  return getMatchingTags(name, token, tags);
};

/**
 * Calls GitHub's API to get a release by tag name.
 * https://docs.github.com/en/rest/releases/releases#get-a-release-by-tag-name
 * @param name repository name including username. ex: node/node or bcoe/yargs
 * @param token
 * @param tags list of possible tag names to fetch. The first one to match will be returned.
 *
 * @returns string first given tag that matches a release on GitHub, or undefined if none match.
 */
const getReleaseForTags = async (
  name: string,
  token: string,
  tags: string[]
): Promise<string | undefined> => {
  const client = gh.client(token, clientOptions);
  for (const tag of tags) {
    const apiPath = `/repos/${name}/releases/tags/${tag}`;
    const release = await new Promise<string | undefined>((resolve, reject) => {
      client.get(
        apiPath,
        {},
        (err: {statusCode: number}, code: number, resp: {name: string}) => {
          if (err) {
            if (err.statusCode === 404) {
              // A release matching this tag wasn't found. This isn't an error, just try the next tag in the list.
              console.info(`${apiPath} returned 404`);
              return resolve(undefined);
            } else {
              return reject(
                Error(
                  `getReleaseForTags: tag = ${tag}, statusCode = ${err.statusCode}, err = ${err}`
                )
              );
            }
          }
          resolve(resp?.name || undefined);
        }
      );
    });
    console.info(`Queried ${apiPath} => %o`, release);
    if (release) {
      return release;
    }
  }
  console.info('No matching releases found.');
  return undefined;
};

/**
 * Calls GitHub's API to check if a specific tag exists.
 * https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#get-a-reference
 * @param name repository name including username. ex: node/node or bcoe/yargs
 * @param token
 * @param matchingTags list of possible tag names to fetch. The first one to match will be returned.
 *
 * @returns string first given tag that matches a tag on GitHub, or undefined if none match.
 */
const getMatchingTags = async (
  name: string,
  token: string,
  matchingTags: string[]
): Promise<string | undefined> => {
  const client = gh.client(token, clientOptions);
  for (const tag of matchingTags) {
    const apiPath = `/repos/${name}/git/refs/tags/${tag}`;
    const exists = await new Promise<boolean>((resolve, reject) => {
      client.get(apiPath, (err: {statusCode: number}, code: number) => {
        if (err) {
          if (err.statusCode === 404) {
            return resolve(false);
          }
          return reject(
            Error(
              `getMatchingTags: tag = ${tag}, statusCode = ${err.statusCode}, err = ${err}`
            )
          );
        }
        if (code !== 200) {
          return reject(
            Error(
              `getMatchingTags: tag = ${tag}, unexpected http code = ${code}`
            )
          );
        }
        resolve(true);
      });
    });
    if (exists) {
      console.info(`Found matching tag: ${tag}`);
      return tag;
    }
  }
  console.info('No matching tags found.');
  return undefined;
};

/**
 * calls github's "get a single user api" for a user token
 * https://developer.github.com/v3/users/#get-a-single-user
 */
export const getUser = (token: string): Promise<GhUser> => {
  return new Promise((resolve, reject) => {
    const client = gh.client(token, clientOptions);
    client.get('/user', (err: Error, status: number, data: GhUser) => {
      if (err || status !== 200) {
        err =
          err ||
          new Error(
            'status ' + status + ' returned from github accessing user'
          );
        return reject(err);
      }
      resolve(data);
    });
  });
};

export const webAccessToken = (
  appid: string,
  appsecret: string,
  code: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    gh.auth
      .config({
        id: appid,
        secret: appsecret,
      })
      .login(code, (err: Error | undefined, token: string) => {
        if (err) return reject(err);
        resolve(token);
      });
  });
};

export const webAccessLink = (
  appid: string,
  appsecret: string,
  scopes: string[]
) => {
  const link = gh.auth
    .config({id: appid, secret: appsecret})
    .login(scopes) as string;
  const code = link.match(/&state=([0-9a-z]{32})/i) || '';
  return {link, code};
};

export const setApiUrl = (url?: string) => {
  if (!url) {
    clientOptions = {};
    return;
  }
  const {protocol, hostname, port} = new URL(url);
  clientOptions = {protocol, hostname, port};
};

// add props as needed.
export interface GhUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

export interface GhRepo {
  name: string;
  full_name: string;
  private: boolean;
  permissions: {push: boolean; admin: boolean; pull: boolean};
}
