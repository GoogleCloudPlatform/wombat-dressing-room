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

import {resolve} from 'path';
import {URL} from 'url';

const gh = require('octonode');

let clientOptions: {}|undefined;

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
                'status ' + status + ' returned from github accessing ' + name);
        reject(err);
      }
      resolve(data);
    });
  });
};

/**
 * calls github's "get a single user api" for a user token
 * https://developer.github.com/v3/users/#get-a-single-user
 */
export const getUser = (token: string): Promise<GhUser >=> {
  return new Promise((resolve, reject) => {
    const client = gh.client(token, clientOptions);
    client.get('/user', (err: Error, status: number, data: GhUser) => {
      if (err || status !== 200) {
        err = err ||
            new Error(
                  'status ' + status + ' returned from github accessing user');
        return reject(err);
      }
      resolve(data);
    });
  });
};

export const webAccessToken =
    (appid: string, appsecret: string, code: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        gh.auth
            .config({
              id: appid,
              secret: appsecret,
            })
            .login(code, (err: Error|undefined, token: string, headers: {}) => {
              if (err) return reject(err);
              resolve(token);
            });
      });
    };

export const webAccessLink =
    (appid: string, appsecret: string, scopes: string[]) => {
      const link =
          gh.auth.config({id: appid, secret: appsecret}).login(scopes) as
          string;
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
}

export interface GhRepo {
  name: string;
  full_name: string;

  private: boolean;
  permissions: {push: boolean, admin: boolean, pull: boolean};
}
