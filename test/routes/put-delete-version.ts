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

import {expect} from 'chai';
import {Request, Response} from 'express';
import * as nock from 'nock';
import {describe, it} from 'mocha';

import {createPackument} from '../helpers/create-packument';
import {writePackageRequest} from '../helpers/write-package-request';

import * as datastore from '../../src/lib/datastore';
import {PublishKey, User} from '../../src/lib/datastore';
import {putDeleteVersion} from '../../src/routes/put-delete-version';
import {writePackage, WriteResponse} from '../../src/lib/write-package';

nock.disableNetConnect();

function mockResponse() {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status: (_code: number) => {
      return;
    },
    end: () => {},
    json: () => {},
  } as Response;
}

describe('putDeleteVersion', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return false;
      },
    });
    const req = ({
      headers: {authorization: 'token: abc123'},
      params: {package: '@soldair/foo'},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as Request;
    const res = mockResponse();
    const result = await putDeleteVersion(req, res);
    expect(result?.statusCode).to.equal(401);
    expect(result?.error).to.match(/publish key not found/);
  });

  it('allows a package version to be deleted', async () => {
    // Fake that there's a token in datastore:
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          releaseAs2FA: false,
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'bcoe', token: 'deadbeef'};
      },
    });
    writePackage.pipeToNpm = (
      req: Request,
      res: Response,
      drainedBody: false | Buffer,
      newPackage: boolean
    ): Promise<WriteResponse> => {
      return Promise.resolve({statusCode: 200, newPackage});
    };

    // Simulate a publication request to the proxy:
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      '0.2.3',
      '@soldair/foo'
    );
    const res = mockResponse();

    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('0.1.0', 'https://github.com/foo/bar')
          .packument()
      );

    const githubRequest = nock('https://api.github.com')
      // user has push access to repo in package.json
      .get('/repos/foo/bar')
      .reply(200, {permissions: {push: true}});

    const result = await putDeleteVersion(req, res);
    npmRequest.done();
    githubRequest.done();
    expect(result.newPackage).to.equal(false);
    expect(result.statusCode).to.equal(200);
  });
});
