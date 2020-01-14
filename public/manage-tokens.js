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

const state = {};

const loop = async () => {
  // init handlers
  tokenForm();
  tokenList();

  const result = await api.tokens();
  console.log(result);
  if (result.error) {
    state.error = result.error;
  }
  state.tokens = result.data;

  render();
};

function render() {
  renderCreatedTokens();
  renderTokens();
  renderError();
}

function tokenForm() {
  if (!state.tokenForm) {
    state.tokenForm = {};
  } else {
    // only run these bindings once.
    return;
  }

  const tokenForm = document.querySelectorAll('form[name=create-token]')[0];
  tokenForm.addEventListener('submit', async ev => {
    ev.stopPropagation();
    ev.preventDefault();
    if (tokenForm.submitting) {
      return;
    }

    const packageNameInput = tokenForm.querySelector('*[name=package-name]');
    const packageName = packageNameInput.value;
    console.log('packageName: ', packageName);
    if (!packageName.trim().length) {
      alert('package name required.');
      return;
    }

    const loading = tokenForm.querySelector('.loading');
    loading.setAttribute('style', 'display:block;');
    state.tokenForm.submitting = true;

    try {
      //token,package
      const result = await api.tokenCreate(packageName);
      console.log('token create result', result);

      if (result.error) {
        alert(result.error);
      }

      if (!state.tokenForm.createdTokens) {
        state.tokenForm.createdTokens = [];
      }

      [].push.apply(state.tokenForm.createdTokens, result.data);
    } catch (e) {
      console.log(e + e.stack);
      alert('an error occurred.');
    }

    state.tokenForm.submitting = false;
    loading.setAttribute('style', 'display:none;');
    if (packageNameInput.value === packageName) {
      packageNameInput.value = '';
    }

    // re-apply state
    loop();
  });
}

function tokenList() {
  if (tokenList.bound) return;
  tokenList.bound = true;

  document.getElementById('tokens-list').addEventListener('click', async ev => {
    const clicked = ev.target;

    const classText = clicked.getAttribute('class');
    if (classText && classText.indexOf('token-delete') > -1) {
      ev.preventDefault();
      ev.stopPropagation();

      if (clicked.getAttribute('data-submitting')) {
        return;
      }

      const href = clicked.getAttribute('href').substr(1);
      console.log('href value ', href);
      const params = qs(href);

      console.log(params);

      if (
        !confirm(
          'are you sure you wan to delete the token starting with ' +
            params.prefix
        )
      ) {
        return;
      }

      clicked.setAttribute('data-submitting', 1);
      const result = await api.tokenDelete(params);
      if (result.error) {
        return alert(result.error);
      }

      // reload state.
      loop();
    }
  });
}

function renderTokens() {
  if (!state.tokens) return;

  const tokensList = document.getElementById('tokens-list');
  if (state.tokens.error) {
    tokensList.innerText = 'error loading tokens.';
    const link = document.createElement('a');
    link.href = 'javascript:window.location.reload()';
    link.appendChild = document.createTextNode('please refresh to try again.');
    tokensList.appendChild(link);
    return;
  }

  const table = tableize(
    state.tokens,
    ['prefix', 'package', 'created', 'expires', 'release-backed', 'actions'],
    (row, k, td) => {
      switch (k) {
        case 'expires':
          if (row.expiration) {
            td.innerText = new Date(row.expiration).toJSON();
          } else {
            const span = document.createElement('span');
            span.style = 'color:#999';
            span.appendChild(document.createTextNode('never'));
            td.appendChild(span);
          }
          break;
        case 'created':
          td.innerText = new Date(row[k]).toJSON();
          break;
        case 'package':
          td.innerText = row[k] || 'all packages';
          break;
        case 'prefix':
          td.innerText = '' + row[k] + '...';
          break;
        case 'release-backed':
          td.innerText = row[k] ? 'true' : 'false';
          break;
        case 'actions': {
          const link = document.createElement('a');
          link.setAttribute('class', 'token-delete');
          link.href =
            '#created=' +
            encodeURIComponent(row.created) +
            '&prefix=' +
            encodeURIComponent(row.prefix);
          link.appendChild(document.createTextNode('delete'));
          td.appendChild(link);
          break;
        }
        default:
          td.innerText = '' + row[k];
      }
      return td;
    }
  );
  tokensList.innerHTML = '';
  tokensList.appendChild(table);
}

function tableize(rows, keys, map) {
  const table = document.createElement('table');
  const headRow = document.createElement('tr');
  keys.forEach(k => {
    const th = document.createElement('th');
    th.innerText = k;
    table.appendChild(th);
  });
  table.appendChild(headRow);

  rows.forEach(row => {
    const tr = document.createElement('tr');
    keys.forEach(k => {
      const td = document.createElement('td');
      map(row, k, td);
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  return table;
}

function renderError() {
  if (!state.error) {
    return;
  }

  const errorDisplay = document.getElementById('error');
  if (errorDisplay) {
    errorDisplay.innerText = state.error;
  }
}

function renderCreatedTokens() {
  if (!state.tokenForm || !state.tokenForm.createdTokens) {
    return;
  }

  const display = document.getElementById('created-tokens-display');
  display.setAttribute('style', 'display:block');
  const listTarget = display.querySelector('#created-list');

  const frag = document.createDocumentFragment();

  state.tokenForm.createdTokens.forEach(token => {
    const listItem = document.createElement('li');
    listItem.appendChild(
      document.createTextNode(token.token + ', ' + token.package)
    );
    frag.appendChild(listItem);
  });

  listTarget.innerHTML = '';
  listTarget.appendChild(frag);
}

function qs(str) {
  const params = {};
  str.split('&').forEach(kv => {
    const parts = kv.split('=');
    params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  });
  return params;
}

loop();
