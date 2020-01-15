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
import {config} from '../lib/config';
import {require2fa} from '../lib/packument';
import {totpCode} from '../lib/totp-code';
import {writePackage} from '../lib/write-package';

export const publish = async (req: express.Request, res: express.Response) => {
  const plainPackageName = req.url.substr(1);
  const packageName = decodeURIComponent(plainPackageName);
  const result = await writePackage(packageName, req, res);
  if (result.newPackage && result.statusCode === 200) {
    try {
      const res = await require2fa(
        packageName,
        config.npmToken,
        totpCode(config.totpSecret)
      );
      console.log(
        'enabled per package 2fa for ' + packageName + '? ',
        res.status,
        res.data + ''
      );
    } catch (e) {
      console.log(
        'attempted to enable per package 2fa for ' +
          packageName +
          ' but got error ' +
          e
      );
    }
  }
};
