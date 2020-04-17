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

import {Packument, PackumentVersion, Repository} from '@npm/types';

class PackumentBuilder {
  versions: PackumentVersion[] = [];
  name: string;
  tag: string;
  constructor(name: string, tag = 'latest') {
    this.name = name;
    this.tag = tag;
  }
  addVersion(
    versionNumber: string,
    repository?: Repository,
    npmUser = 'soldair'
  ): PackumentBuilder {
    const version = {
      id: this.name,
      name: this.name,
      version: versionNumber,
      npmVersion: '6.11.3',
      nodeVersion: '10.10.0',
      maintainers: [],
      npmUser,
      repository,
      dist: {tarball: 'example.com', shasum: 'abc123'},
    };
    this.versions.push(version);
    return this;
  }
  packument(): Packument {
    const packument = {
      name: this.name,
      'dist-tags': {},
      maintainers: [],
      versions: {},
      time: {modified: '', created: ''},
      license: '',
    } as Packument;
    for (const version of this.versions) {
      packument.versions[version.version] = version;
      packument['dist-tags'][this.tag] = version.version;
    }
    return packument;
  }
}

export function createPackument(
  name: string,
  tag = 'latest'
): PackumentBuilder {
  return new PackumentBuilder(name, tag);
}
