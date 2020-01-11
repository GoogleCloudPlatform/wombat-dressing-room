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

/**
 * @fileoverview Description of this file.
 */
import * as fs from 'fs';
import * as os from 'os';

require('dotenv').config('../.env');

export const config = {
  bucket: process.env.BUCKET,
  credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  sessionSecret: process.env.SESSION_SECRET || null,
  totpSecret: process.env.NPM_OTP_SECRET || '',
  npmToken: process.env.NPM_TOKEN || '',
  // used to message users when this account doesn't have permission to publish.
  npmUsername: process.env.NPM_USERNAME,
  tmpDir: process.env.TMP_PUBLISH_DIR || os.tmpdir(),
  // https://github.com/settings/applications
  githubId: process.env.GITHUB_CLIENT_ID || '',
  githubSecret: process.env.GITHUB_CLIENT_SECRET || '',
  // the url folks use on the web.
  userLoginUrl: process.env.LOGIN_URL,
  // the url that folks are supposed to use on the command line.
  userRegistryUrl: process.env.REGISTRY_URL,
  // if users should be able to login.
  loginEnabled: process.env.LOGIN_ENABLED === 'yes-this-is-a-login-server',
  projectId: process.env.DATASTORE_PROJECT_ID,
};

if (process.env.NODE_ENV !== 'test') {
  if (!config.githubId || !config.githubSecret) {
    throw new Error(
      'server doesnt have required credentials. check env vars GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET '
    );
  }

  if (!config.totpSecret || !config.npmToken) {
    throw new Error(
      'server doesnt have required npm credentials. check env vars NPM_TOKEN and NPM_OTP_SECRET.'
    );
  }
}

// check tmp dir.
try {
  const stat = fs.statSync(config.tmpDir);
  if (!stat.isDirectory()) {
    throw new Error('TMP_PUBLISH_DIR is not a directory. ' + config.tmpDir);
  }
  // throws if we can't write to the directory
  fs.accessSync(config.tmpDir, fs.constants.W_OK);
} catch (e) {
  // tmpdir is unavailable somehow. :scream:
  throw new Error('TMP_PUBLISH_DIR is unavailable. ' + e.message);
}
