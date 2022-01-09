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
      const resp: request.Response = await new Promise((resolve, reject) => {
        request(
          {followRedirect: false, url: 'http://localhost:8080/'},
          (err, resp) => {
            if (err) return reject(err);
            return resolve(resp);
          }
        );
      });
      assert.strictEqual(resp.statusCode, 302);
      assert.strictEqual(resp.headers?.location, 'http://www.example.com/');
    });
  });
});
