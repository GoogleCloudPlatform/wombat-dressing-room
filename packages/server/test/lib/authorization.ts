import {expect} from 'chai';
import {Request, Response} from 'express';
import * as nock from 'nock';
import {describe, it} from 'mocha';

import {createPackument} from '../helpers/create-packument';
import {writePackageRequest} from '../helpers/write-package-request';

import * as datastore from '../../src/lib/datastore';
import {PublishKey, User} from '../../src/lib/datastore';
import {WombatServerError} from '../../src/lib/wombat-server-error';
import {authorizeNpmAction} from '../../src/lib/authorization';

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

describe('authorizeNpmAction', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    const mockedDatastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return false;
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = mockResponse();
    const ret = await authorizeNpmAction(
      '@soldair/foo',
      req,
      res,
      undefined,
      mockedDatastore
    );
    expect(ret.authorized).to.equal(false);
  });

  it('responds with 401 if publication key expired', async () => {
    const mockedDatastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          expiration: Date.now() - 1000,
        };
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = mockResponse();
    const ret = await authorizeNpmAction(
      '@soldair/foo',
      req,
      res,
      undefined,
      mockedDatastore
    );
    expect(ret.authorized).to.equal(false);
  });

  it('responds with 401 if user not found', async () => {
    const mockedDatastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return false;
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = mockResponse();
    const ret = await authorizeNpmAction(
      '@soldair/foo',
      req,
      res,
      undefined,
      mockedDatastore
    );
    expect(ret.authorized).to.equal(false);
  });

  it('responds with 401 if token is scoped to a different package', async () => {
    const mockedDatastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          package: '@soldair/other',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'bcoe', token: 'deadbeef'};
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = mockResponse();
    const ret = await authorizeNpmAction(
      '@soldair/foo',
      req,
      res,
      undefined,
      mockedDatastore
    );
    expect(ret.authorized).to.equal(false);
  });

  it('authorizes if permissions are valid and releaseAs2FA is disabled', async () => {
    const mockedDatastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
        };
      },
      getUser: async (): Promise<false | User> => {
        return {name: 'bcoe', token: 'deadbeef'};
      },
    });

    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo')
        .addVersion('1.0.0', 'https://github.com/foo/bar')
        .packument()
    );
    const res = mockResponse();

    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(404);

    const githubRequest = nock('https://api.github.com')
      .get('/repos/foo/bar')
      .reply(200, {permissions: {push: true}});

    const ret = await authorizeNpmAction(
      '@soldair/foo',
      req,
      res,
      undefined,
      mockedDatastore
    );
    npmRequest.done();
    githubRequest.done();
    expect(ret.authorized).to.equal(true);
    expect(ret.newPackage).to.equal(true);
  });
});

describe('enforceMatchingRelease', () => {
  it('throws error if target version cannot be determined', async () => {
    const {enforceMatchingRelease} = require('../../src/lib/authorization');
    try {
      await enforceMatchingRelease('foo/bar', 'token', undefined, false);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as WombatServerError;
      expect(error.message).to.match(/Could not determine target version/);
      expect(error.statusCode).to.equal(400);
    }
  });

  it('throws 500 for unknown error types', async () => {
    const {enforceMatchingRelease} = require('../../src/lib/authorization');
    // We can force an unknown error by mocking JSON.parse to throw a string instead of an Error object
    const originalParse = JSON.parse;
    JSON.parse = () => {
      throw 'string error';
    };
    try {
      await enforceMatchingRelease(
        'foo/bar',
        'token',
        undefined,
        Buffer.from('{}')
      );
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as WombatServerError;
      expect(error.message).to.equal('unknown error');
      expect(error.statusCode).to.equal(500);
    } finally {
      JSON.parse = originalParse;
    }
  });
});
