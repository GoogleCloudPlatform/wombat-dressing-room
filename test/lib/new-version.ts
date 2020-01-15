/**
 * Copyright 2019 Google LLC
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
import {createPackument} from '../helpers/create-packument';

import {newVersions} from '../../src/lib/new-versions';

describe('newVersions', () => {
  it('returns versions added to packument "a" since packument "b"', () => {
    const versions = newVersions(
      createPackument('a')
        .addVersion('1.0.0')
        .packument(),
      createPackument('a')
        .addVersion('1.0.0')
        .addVersion('1.1.0')
        .packument()
    );
    expect(versions).to.eql(['1.1.0']);
  });

  it('returns an empty list if no new versions have been added', () => {
    const versions = newVersions(
      createPackument('a')
        .addVersion('1.0.0')
        .packument(),
      createPackument('a')
        .addVersion('1.0.0')
        .packument()
    );
    expect(versions).to.eql([]);
  });
});
