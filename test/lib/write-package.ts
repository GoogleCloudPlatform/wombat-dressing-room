import {expect} from 'chai';
import {Request, Response} from 'express';

import * as datastore from '../../src/lib/datastore';
import {PublishKey} from '../../src/lib/datastore';
import {writePackage} from '../../src/lib/write-package';

import request = require('request');

describe('writePackage', () => {
  it('responds with 401 if publication key not found in datastore',
     async () => {
       writePackage.datastore = Object.assign({}, datastore, {
         getPublishKey: async(username: string): Promise<PublishKey|false> => {
           return false;
         }
       });
       const req = {headers: {authorization: 'token: abc123'}} as Request;
       const res = {status: (code: number) => {}, end: () => {}} as Response;
       const ret = await writePackage('@soldair/foo', req, res);
       expect(ret.statusCode).to.equal(401);
       expect(ret.error).to.match(/publish key not found/);
     });
});