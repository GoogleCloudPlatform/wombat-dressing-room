/**
 * Copyright 2020 Google LLC
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

import * as express from 'express';
import {writePackage} from '../lib/write-package';
import {authorizeNpmAction} from '../lib/authorization';
import * as datastore from '../lib/datastore';

// PUT
// https://wombat-dressing-room.appspot.com/release-please-sql-test/-rev/1-deadbeef
export const putDeleteVersion = async (
  req: express.Request,
  res: express.Response
) => {
  const packageName = decodeURIComponent(req.params.package);

  // Try to extract version from tarball name
  const tarball = req.params.tarball || '';
  const match = tarball.match(/-(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\.tgz$/);
  let targetVersion = match ? match[1] : undefined;

  // If not in tarball, maybe it's in the tag parameter?
  if (!targetVersion && req.params.tag) {
    if (/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?$/.test(req.params.tag)) {
      targetVersion = req.params.tag;
    }
  }

  const authResult = await authorizeNpmAction(
    packageName,
    req,
    res,
    targetVersion,
    putDeleteVersion.datastore
  );

  let result: {statusCode: number; error?: string; newPackage?: boolean} = {
    statusCode: 200,
  };

  if (!authResult.authorized) {
    result = {
      statusCode: authResult.statusCode || 400,
      error: authResult.error,
    };
  } else {
    result = await writePackage.pipeToNpm(
      req,
      res,
      authResult.drainedBody || false,
      false
    );
  }

  if (result.error) {
    console.error('unpublish error ', req.url, result);
  } else {
    console.info(`auth unpublish for ${req.params.package}`);
  }
  return result;
};

putDeleteVersion.datastore = datastore;
