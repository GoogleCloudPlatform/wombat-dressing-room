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

import {Packument} from '@npm/types';

// Returns a list of versions that exist in p2, but not in p1:
export const newVersions = (p1: Packument, p2: Packument): string[] => {
  const versions1 = new Set(Object.keys(p1.versions));
  const versions2 = new Set(Object.keys(p2.versions));
  return [...versions2].filter(version => {
    return !versions1.has(version);
  });
};
