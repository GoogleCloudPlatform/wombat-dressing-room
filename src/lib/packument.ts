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

import {Packument, PackumentVersion, Repository} from '@npm/types';
import * as request from 'request';
import {URL} from 'url';
import {json} from './json';

const parseGh = require('github-url-from-git');
let registryUrl = 'https://registry.npmjs.org';

// this only fetches public packuments.
// if we passed auth it could fetch any the publish user has access to.
export const packument = (name: string): Promise<Packument|false >=> {
  const url = registryUrl + '/' + name.replace('/', '%2f');
  const p = new Promise((resolve, reject) => {
              request(url, (err, res, body) => {
                if (err) {
                  return reject(err);
                }
                if (res.statusCode === 404) {
                  resolve(false);
                } else if (res.statusCode === 200) {
                  const result = json(body) as Packument;
                  if (!result) {
                    return reject(new Error('packument did not parse'));
                  }
                  resolve(result);
                } else {
                  reject(new Error('unexpected status code from npm'));
                }
              });
            }) as Promise<Packument|false>;
  return p;
};

export const repoToGithub =
    (repo?: Repository): false|{name: string, url: string} => {
      if (repo) {
        if (typeof repo === 'string') {
          repo = {type: 'git', url: repo};
        }
        if (repo.type === 'git' && typeof repo.url === 'string') {
          // the only format npm supports that this package doesnt is
          // "username/reponame" are by default resolved to github

          const url = parseGh(repo.url);
          if (url && url.indexOf('https://github.com') === 0) {
            return {url, name: new URL(url).pathname.substr(1)};
          }
          if (!url && repo.url.match(/^[^/]+\/[^/]+$/)) {
            //'xxxx/xxxx' username/repo specifier
            return {url: 'https://github.com/' + repo.url, name: repo.url};
          }
        }
      }
      return false;
    };

export const findLatest = (doc: Packument): PackumentVersion|undefined => {
  const latest = doc['dist-tags'] ? doc['dist-tags'].latest : false;
  if (!latest) {
    let newestVersion = '';
    const versionDate = 0;
    // most recent
    Object.keys(doc.time || {}).forEach((version) => {
      if (version === 'created' || version === 'modified') {
        return;
      }
      const t = new Date(doc.time[version]).getTime();
      if (t >= versionDate) newestVersion = version;
    });
    return doc.versions ? doc.versions[newestVersion] : undefined;
  }
  return doc.versions[latest];
};

export const setRegistryUrl = (url: string) => {
  registryUrl = url;
};


export const require2fa = (packageName: string, token: string, otpCode: string):
    Promise<{status: number, data: Buffer} >=> {
  let ended = false;

  return new Promise((resolve, reject) => {
    console.log(packageName);
    const cleanPackageName =
        encodeURIComponent(packageName);

    const url = registryUrl + '/-/package/' + cleanPackageName + '/access';
    const toWrite = '';
    // TODO(@ssoldair): investigate whether there's a way to not have this
    // tied to a prior session and your robot scope?
    const req = request(url, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + token,
        'referer': 'access 2fa-required ' + packageName,
        'accept': 'application/json',
        'content-type': 'application/json',
        'content-length': toWrite.length,
        'npm-otp': otpCode,
        'npm-session': Date.now().toString(36),
        'user-agent': 'wombat-dressing-room',
        'version': '6.4.1',
        'accept-encoding': 'gzip',
        'npm-in-ci': 'false'
      }
    });

    req.write(toWrite);
    req.end();
    req.on('response', (res: request.Response) => {
      console.log(res.statusCode);
      console.log(res.headers);

      const status = res.statusCode;
      const buf: Buffer[] = [];
      res.on('data', (b) => {
        buf.push(b);
      });
      res.on('error', (err) => {
        if (ended) return;
        ended = true;
        reject(err);
      });
      res.on('end', () => {
        resolve({status, data: Buffer.concat(buf)});
      });
    });

    req.on('error', (err: Error) => {
      if (ended) return;
      ended = true;
      reject(err);
    });
  });
};
