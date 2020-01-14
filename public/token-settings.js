/**
 * Copyright 2020 Google LLC
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

const query = {};
(window.location.search || '?')
  .substr(1)
  .split('&')
  .forEach(kv => {
    kv = kv.split('=');
    query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });

if (query.ott) {
  document.querySelectorAll('.ott').forEach(el => {
    el.value = query.ott;
  });
} else {
  console.log('error. ott not found.');
}

const settings = document.getElementById('settings');
const packageInput = document.querySelector('input[name=package]');
settings.addEventListener('submit', ev => {
  const pkg = packageInput.value;
  if (!pkg.length) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    packageInput.setAttribute('class', 'errored');
    setTimeout(() => {
      packageInput.setAttribute('class', '');
    }, 1000);
    return;
  }
});

if (query.package) {
  packageInput.value = decodeURIComponent(query.package);
}
