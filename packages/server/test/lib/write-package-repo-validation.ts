/**
 * Copyright 2025 Google LLC
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

describe('writePackage repository validation', () => {
  it('responds with 400 if a NEW package has no repository field', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
      },
    });

    // Incoming request has NO repository
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo').addVersion('1.0.0').packument()
    );
    const res = mockResponse();

    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(404);

    const ret = await writePackage('@soldair/foo', req, res);
    npmRequest.done();
    expect(ret.statusCode).to.equal(400);
    expect(ret.error).to.match(/must have a repository/);
  });

  it('fails to update if BOTH latest on registry and incoming request have no repository', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
      },
    });

    // Incoming request has NO repository
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo').addVersion('1.1.0').packument()
    );
    const res = mockResponse();

    // Registry version also has NO repository
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo').addVersion('1.0.0').packument()
      );

    const ret = await writePackage('@soldair/foo', req, res);
    npmRequest.done();
    expect(ret.statusCode).to.equal(400);
    expect(ret.error).to.match(/must have a repository/);
  });

  it('successfully updates if registry lacks repository but incoming request HAS it', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
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

    // Incoming request HAS repository
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo')
        .addVersion('1.1.0', 'https://github.com/foo/bar')
        .packument()
    );
    const res = mockResponse();

    // Registry version LACKS repository
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo').addVersion('1.0.0').packument()
      );

    const githubRequest = nock('https://api.github.com')
      .get('/repos/foo/bar')
      .reply(200, {permissions: {push: true}});

    const ret = await writePackage('@soldair/foo', req, res);
    npmRequest.done();
    githubRequest.done();

    expect(ret.statusCode).to.equal(200);
    expect(ret.error).to.be.undefined;

    nock.cleanAll();
  });

  it('fails if user has access to registry repo but NOT to incoming request repo', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
      },
    });

    // Incoming request has repo B
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo')
        .addVersion('1.1.0', 'https://github.com/foo/repo-B')
        .packument()
    );
    const res = mockResponse();

    // Registry version has repo A
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/repo-A')
          .packument()
      );

    const githubRequestA = nock('https://api.github.com')
      .get('/repos/foo/repo-A')
      .reply(200, {permissions: {push: true}});

    const githubRequestB = nock('https://api.github.com')
      .get('/repos/foo/repo-B')
      .reply(200, {permissions: {push: false}}); // No access to B!

    const ret = await writePackage('@soldair/foo', req, res);
    npmRequest.done();
    githubRequestA.done();
    githubRequestB.done();

    expect(ret.statusCode).to.equal(400);
    expect(ret.error).to.match(
      /suztomo cannot push repo https:\/\/github.com\/foo\/repo-B/
    );
  });

  it('successfully updates if user has access to BOTH registry repo and different incoming request repo', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
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

    // Incoming request has repo B
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo')
        .addVersion('1.1.0', 'https://github.com/foo/repo-B')
        .packument()
    );
    const res = mockResponse();

    // Registry version has repo A
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/repo-A')
          .packument()
      );

    const githubRequestA = nock('https://api.github.com')
      .get('/repos/foo/repo-A')
      .reply(200, {permissions: {push: true}});

    const githubRequestB = nock('https://api.github.com')
      .get('/repos/foo/repo-B')
      .reply(200, {permissions: {push: true}});

    const ret = await writePackage('@soldair/foo', req, res);

    expect(ret.error).to.be.undefined;
    expect(ret.statusCode).to.equal(200);

    npmRequest.done();
    githubRequestA.done();
    githubRequestB.done();
  });

  it('successfully updates if dist-tags has NO latest or next (e.g., npm publish --no-tag)', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'suztomo',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'suztomo', token: 'deadbeef'};
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

    // Incoming request has repo B, but NO latest/next tag. It has "false" tag.
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo', 'false')
        .addVersion('1.1.0', 'https://github.com/foo/repo-B')
        .packument()
    );
    const res = mockResponse();

    // Registry version has repo A
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(
        200,
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/repo-A')
          .packument()
      );

    const githubRequestA = nock('https://api.github.com')
      .get('/repos/foo/repo-A')
      .reply(200, {permissions: {push: true}});

    const githubRequestB = nock('https://api.github.com')
      .get('/repos/foo/repo-B')
      .reply(200, {permissions: {push: true}});

    const ret = await writePackage('@soldair/foo', req, res);

    expect(ret.error).to.be.undefined;
    expect(ret.statusCode).to.equal(200);

    npmRequest.done();
    githubRequestA.done();
    githubRequestB.done();

    nock.cleanAll();
  });
});
