/**
 * Copyright 2022 Google LLC
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

import * as nock from 'nock';
import * as sinon from 'sinon';
import {afterEach, describe, it} from 'mocha';
import app from '../src/server';
import * as request from 'request';
import * as assert from 'assert';

import * as Config from '../src/lib/config';
import {Server} from 'http';

interface RequestOpts {
  url: string;
}

function requestAsync(opts: RequestOpts): Promise<request.Response> {
  return new Promise((resolve, reject) => {
    request({followRedirect: false, ...opts}, (err, resp) => {
      if (err) return reject(err);
      return resolve(resp);
    });
  });
}

describe('server', () => {
  let server: Server;
  before(() => {
    nock.enableNetConnect('localhost:8080');
  });
  beforeEach(async () => {
    return new Promise(resolve => {
      server = app.listen(8080, () => {
        return resolve();
      });
    });
  });
  afterEach(async () => {
    return new Promise(resolve => {
      server.close(() => {
        return resolve();
      });
    });
  });
  describe('/', () => {
    it('redirects to frontend loginEnabled is false', async () => {
      sinon.stub(Config, 'config').value({
        userLoginUrl: 'http://www.example.com',
        loginEnabled: false,
      });
      const resp = await requestAsync({url: 'http://localhost:8080/'});
      assert.strictEqual(resp.statusCode, 302);
      assert.strictEqual(resp.headers?.location, 'http://www.example.com/');
    });
    it('service index if loginEnabled is true', async () => {
      sinon.stub(Config, 'config').value({
        userLoginUrl: 'http://www.example.com',
        loginEnabled: true,
      });
      const resp = await requestAsync({url: 'http://localhost:8080/'});
      assert.strictEqual(resp.statusCode, 200);
      assert(resp.body.includes('enable JavaScript'));
    });
  });
  describe('static', () => {
    it('serves static routes', async () => {
      let resp = await requestAsync({url: 'http://localhost:8080/_/help'});
      assert(resp.body.includes('enable JavaScript'));
      resp = await requestAsync({url: 'http://localhost:8080/_/login'});
      assert(resp.body.includes('enable JavaScript'));
      resp = await requestAsync({url: 'http://localhost:8080/_/manage'});
      assert(resp.body.includes('enable JavaScript'));
      resp = await requestAsync({url: 'http://localhost:8080/robots.txt'});
      assert(resp.body.includes('User-agent'));
    });
  });
});
