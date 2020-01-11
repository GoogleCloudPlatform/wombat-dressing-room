import {PackumentVersion} from '@npm/types';
import {expect} from 'chai';

import {newVersions} from '../../src/lib/new-versions';

function createVersion(version: string): PackumentVersion {
  return {
    id: 'a',
    name: 'a',
    version,
    npmVersion: '6.11.3',
    nodeVersion: '10.10.0',
    maintainers: [],
    npmUser: 'soldair',
    dist: {tarball: 'example.com', shasum: 'abc123'},
  };
}

describe('newVersions', () => {
  it('returns versions added to packument "a" since packument "b"', () => {
    const versions = newVersions(
      {
        name: 'a',
        'dist-tags': {cool: ''},
        maintainers: [],
        versions: {
          '1.0.0': createVersion('1.0.0'),
        },
        time: {modified: '', created: ''},
        license: '',
      },
      {
        name: 'a',
        'dist-tags': {},
        maintainers: [],
        versions: {
          '1.0.0': createVersion('1.0.0'),
          '1.1.0': createVersion('1.1.0'),
        },
        time: {modified: '', created: ''},
        license: '',
      }
    );
    expect(versions).to.eql(['1.1.0']);
  });

  it('returns an empty list if no new versions have been added', () => {
    const versions = newVersions(
      {
        name: 'a',
        'dist-tags': {cool: ''},
        maintainers: [],
        versions: {
          '1.0.0': createVersion('1.0.0'),
        },
        time: {modified: '', created: ''},
        license: '',
      },
      {
        name: 'a',
        'dist-tags': {},
        maintainers: [],
        versions: {'1.0.0': createVersion('1.0.0')},
        time: {modified: '', created: ''},
        license: '',
      }
    );
    expect(versions).to.eql([]);
  });
});
