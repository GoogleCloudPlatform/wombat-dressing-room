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

import {Request, Response} from 'express';
import * as request from 'request';

import {config} from '../lib/config';
import {totpCode} from '../lib/totp-code';

import * as datastore from './datastore';
import {authorizeNpmAction} from './authorization';

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
  const authResult = await authorizeNpmAction(
    packageName,
    req,
    res,
    undefined,
    writePackage.datastore
  );
  if (!authResult.authorized) {
    return {
      statusCode: authResult.statusCode || 400,
      error: authResult.error,
    };
  }

  return writePackage.pipeToNpm(
    req,
    res,
    authResult.drainedBody || false,
    authResult.newPackage || false
  );
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


writePackage.datastore = datastore;


