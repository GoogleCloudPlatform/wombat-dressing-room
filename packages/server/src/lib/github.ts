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
  const matchingRelease = await getReleaseForTags(name, token, tags);
  if (matchingRelease) {
    return matchingRelease;
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
    const release = await new Promise<string | undefined>((resolve, reject) => {
      client.get(
        `/repos/${name}/releases/tags/${tag}`,
        {},
        (err: Error, code: number, resp: {name: string}) => {
          if (err) {
            return reject(
              Error(`getReleaseForTags: tag = ${tag}, err = ${err}`)
            );
          }
          resolve(resp.name || undefined);
        }
      );
    });
    if (release) {
      return release;
    }
  }
  return undefined;
};

/**
 * Calls GitHub's API to list tags for a repository.
 * https://docs.github.com/en/rest/repos/repos#list-repository-tags
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
  // We check up to 1100 of the most recent tags for a match,
  // using a large page size to allow for monorepos with 100s of tags:
  const maxPagination = 12;
  for (let page = 1; page < maxPagination; page++) {
    const tags: [{name: string}] = await new Promise((resolve, reject) => {
      client.get(
        `/repos/${name}/tags`,
        {per_page: 100, page: page},
        (err: Error, code: number, resp: [{name: string}]) => {
          if (err) {
            return reject(
              Error(
                `getMatchingTags: tags = ${matchingTags.toString()}, err = ${err}`
              )
            );
          } else if (code !== 200) {
            return reject(
              new Error(
                `getRelease: unexpected http code = ${code} tag = ${matchingTags.toString()}`
              )
            );
          } else {
            resolve(resp);
          }
        }
      );
    });
    for (const item of tags) {
      for (const tag of matchingTags) {
        if (item.name === tag) {
          return tag;
        }
      }
    }
  }
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
