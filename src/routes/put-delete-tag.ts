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

// PUT
// https://wombat-dressing-room.appspot.com/-/package/soldair-test-package/dist-tags/latest
export const putDeleteTag = async (
  req: express.Request,
  res: express.Response
) => {
  const result = await writePackage(
    decodeURIComponent(req.params.package),
    req,
    res
  );
  // the request has not been ended yet if there has been a wombat
  // error.
  if (result.error) {
    console.log('create dist tag error ', req.url, result);
  } else {
    console.log('');
  }
};
