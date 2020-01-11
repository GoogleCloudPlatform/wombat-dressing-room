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
