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

document.getElementById('logout-link').addEventListener('click', ev => {
  ev.preventDefault();
  logout();
});

async function logout() {
  response = await fetch('/logout', {method: 'POST'});
  window.location = '/';
}

// global api object.
const api = {
  tokens: async () => {
    const res = await fetch('/_/api/v1/tokens');
    const result = await res.json();
    return result;
  },
  tokenDelete: async data => {
    if (!data.prefix || !data.created) {
      throw new Error('key prefix and created required');
    }
    const res = await fetch('/_/api/v1/token', {
      method: 'DELETE',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return await res.json();
  },
  tokenCreate: async package => {
    const res = await fetch('/_/api/v1/token', {
      method: 'PUT',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({package}),
    });
    return await res.json();
  },
};
