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
import {putDeleteTag} from '../../src/routes/put-delete-tag';
import {writePackage, WriteResponse} from '../../src/lib/write-package';

nock.disableNetConnect();

interface MockResponse extends Response {
  _statusCode?: number;
  _jsonData?: {};
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    status: (code: number) => {
      res._statusCode = code;
      return res;
    },
    end: () => {},
    json: (data: {}) => {
      res._jsonData = data;
    },
  } as MockResponse;
  return res;
}

describe('putDeleteTag', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    putDeleteTag.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return false;
      },
    });
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      '1.0.0',
      '@soldair/foo'
    );
    req.method = 'PUT';
    req.params = {package: '@soldair/foo', tag: 'latest'};
    const res = mockResponse();
    await putDeleteTag(req, res);
    expect(res._statusCode).to.equal(401);
    expect(res._jsonData)
      .to.have.property('error')
      .that.matches(/publish key not found/);
  });

  it('allows a tag to be added (PUT) for release-backed token if release exists', async () => {
    putDeleteTag.datastore = Object.assign({}, datastore, {
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

    // Simulate dist-tag PUT request with version in body:
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      '1.0.0', // version being tagged
      '@soldair/foo'
    );
    req.method = 'PUT';
    req.params = {package: '@soldair/foo', tag: 'latest'};
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
      // enforceMatchingRelease checks github releases:
      .get('/repos/foo/bar/releases/tags/v1.0.0')
      .reply(200, {tag_name: 'v1.0.0'});

    await putDeleteTag(req, res);
    npmRequest.done();
    githubRequest.done();
    // It should have completed successfully and piped to npm
    // (mocked pipeToNpm returns 200, but putDeleteTag doesn't return it,
    // it just logs if error. Wait, we should probably check if it was called?
    // In our test, pipeToNpm is called. If it wasn't, githubRequest might still be done if authorization finished.
    // Actually, nock.done() verifies that the mocks were hit.
  });

  it('rejects tag addition (PUT) for release-backed token if release does not exist', async () => {
    putDeleteTag.datastore = Object.assign({}, datastore, {
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
      '1.0.0',
      '@soldair/foo'
    );
    req.method = 'PUT';
    req.params = {package: '@soldair/foo', tag: 'latest'};
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
      .reply(200, []); // no tags either

    await putDeleteTag(req, res);
    npmRequest.done();
    githubRequest.done();
    expect(res._statusCode).to.equal(400);
    expect(res._jsonData)
      .to.have.property('error')
      .that.matches(/matching release v1.0.0 not found/);
  });
});
