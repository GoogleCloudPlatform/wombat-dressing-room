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
    putDeleteVersion.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return false;
      },
    });
    const req = {
      headers: {authorization: 'token: abc123'},
      params: {package: '@soldair/foo'},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as Request;
    const res = mockResponse();
    const result = await putDeleteVersion(req, res);
    expect(result?.statusCode).to.equal(401);
    expect(result?.error).to.match(/publish key not found/);
  });

  it('allows a package version to be deleted', async () => {
    // Fake that there's a token in datastore:
    putDeleteVersion.datastore = Object.assign({}, datastore, {
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
      createPackument('@soldair/foo')
        .addVersion('0.1.0', 'https://github.com/foo/bar')
        .packument(),
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

  it('allows a package version to be deleted (DELETE) for release-backed token if release exists', async () => {
    putDeleteVersion.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          releaseAs2FA: true,
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

    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      undefined,
      '@soldair/foo'
    );
    req.method = 'DELETE';
    req.params = {
      package: '@soldair/foo',
      tarball: '@soldair/foo-1.0.0.tgz',
      sha: 'revision123',
    };
    const res = mockResponse();

    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/bar')
          .packument()
      );

    const githubRequest = nock('https://api.github.com')
      .get('/repos/foo/bar')
      .reply(200, {permissions: {push: true}})
      .get('/repos/foo/bar/releases/tags/v1.0.0')
      .reply(200, {name: 'v1.0.0'});

    const result = await putDeleteVersion(req, res);
    npmRequest.done();
    githubRequest.done();
    expect(result.statusCode).to.equal(200);
  });

  it('rejects package version deletion (DELETE) for release-backed token if release does not exist', async () => {
    putDeleteVersion.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          releaseAs2FA: true,
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'bcoe', token: 'deadbeef'};
      },
    });

    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      undefined,
      '@soldair/foo'
    );
    req.method = 'DELETE';
    req.params = {
      package: '@soldair/foo',
      tarball: '@soldair/foo-1.0.0.tgz',
      sha: 'revision123',
    };
    const res = mockResponse();

    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/bar')
          .packument()
      );

    const githubRequest = nock('https://api.github.com')
      .get('/repos/foo/bar')
      .reply(200, {permissions: {push: true}})
      .get('/repos/foo/bar/releases/tags/v1.0.0')
      .reply(404)
      .get('/repos/foo/bar/tags?per_page=100&page=1')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=2')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=3')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=4')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=5')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=6')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=7')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=8')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=9')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=10')
      .reply(200, [])
      .get('/repos/foo/bar/tags?per_page=100&page=11')
      .reply(200, []);

    const result = await putDeleteVersion(req, res);
    npmRequest.done();
    githubRequest.done();
    expect(result.statusCode).to.equal(400);
    expect(result.error).to.match(/matching release v1.0.0 not found/);
  });
});
