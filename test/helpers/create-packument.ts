import {Packument, PackumentVersion, Repository} from '@npm/types';

class PackumentBuilder {
  versions: PackumentVersion[] = [];
  name: string;
  constructor(name: string) {
    this.name = name;
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
      packument['dist-tags'].latest = version.version;
    }
    return packument;
  }
}

export function createPackument(name: string): PackumentBuilder {
  return new PackumentBuilder(name);
}
