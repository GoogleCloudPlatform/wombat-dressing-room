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
          packageName, config.npmToken, totpCode(config.totpSecret));
      console.log(
          'enabled per package 2fa for ' + packageName + '? ', res.status,
          res.data + '');
    } catch (e) {
      console.log(
          'attempted to enable per package 2fa for ' + packageName +
          ' but got error ' + e);
    }
  }
};
