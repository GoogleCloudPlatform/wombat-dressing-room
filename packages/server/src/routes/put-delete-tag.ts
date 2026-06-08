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

import * as express from 'express';
import {writePackage} from '../lib/write-package';
import {authorizeNpmAction} from '../lib/authorization';
import {drainRequest} from '../lib/drain-request';
import * as datastore from '../lib/datastore';

// PUT
// https://wombat-dressing-room.appspot.com/-/package/soldair-test-package/dist-tags/latest
export const putDeleteTag = async (
  req: express.Request,
  res: express.Response
) => {
  const packageName = decodeURIComponent(req.params.package);
  let drainedBody: false | Buffer = false;
  let targetVersion: string | undefined = undefined;

  if (req.method === 'PUT') {
    drainedBody = await drainRequest(req);
    try {
      targetVersion = JSON.parse(drainedBody + '') as string;
    } catch (e) {
      console.error('Failed to parse dist-tag body:', e);
    }
  }

  const authResult = await authorizeNpmAction(
    packageName,
    req,
    res,
    targetVersion,
    putDeleteTag.datastore
  );

  let result: {statusCode: number; error?: string} = {statusCode: 200};

  if (!authResult.authorized) {
    result = {
      statusCode: authResult.statusCode || 400,
      error: authResult.error,
    };
  } else {
    result = await writePackage.pipeToNpm(req, res, drainedBody, false);
  }

  if (result.error) {
    console.log('create dist tag error ', req.url, result);
  } else {
    console.log('');
  }
};

putDeleteTag.datastore = datastore;
