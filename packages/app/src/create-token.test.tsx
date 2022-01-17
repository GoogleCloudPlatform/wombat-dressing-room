/**
 * Copyright 2021 Google LLC
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

import {render, screen, fireEvent} from '@testing-library/react'
import React from 'react'
import {MemoryRouter} from 'react-router-dom'

import '@testing-library/jest-dom'

import App from './app'

import * as assert from 'assert';

beforeEach(() => {
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// scrollTo is not available in Jest environemnt.
global.window.scrollTo = () => {};

test('allows temporary token to be created', async () => {
  const token = 'abc123';
  global.fetch = jest.fn()
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          authenticated: true,
          login: 'bcoe',
          registryHref: 'http://www.example.com'
        })
      })
    })
    .mockImplementationOnce((_u, post) => {
      const body = JSON.parse(post.body);
      assert.strictEqual(body.type, 'ttl');
      return Promise.resolve({
        json: () => Promise.resolve({
          message: `created token ${token}`
        }),
        status: 200
      })
    });
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  )
  await screen.findByText(/24 hour temporary token/);
  const tempTokenButton = screen.getByTestId('ttl');
  fireEvent.click(tempTokenButton);
  // When a token is first created, it will be displayed in DOM within
  // flash message:
  await screen.findByText(new RegExp(`${token}`));
});

test('allows release-backed token to be created', async () => {
  const token = 'abc123';
  global.fetch = jest.fn()
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          authenticated: true,
          login: 'bcoe',
          registryHref: 'http://www.example.com'
        })
      })
    })
    .mockImplementationOnce((_u, post) => {
      const body = JSON.parse(post.body);
      assert.strictEqual(body.type, 'release');
      return Promise.resolve({
        json: () => Promise.resolve({
          message: `created token ${token}`
        }),
        status: 200
      })
    });
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  )
  await screen.findByText(/24 hour temporary token/);
  const tempTokenButton = screen.getByTestId('release');
  fireEvent.click(tempTokenButton);
  // When a token is first created, it will be displayed in DOM within
  // flash message:
  await screen.findByText(new RegExp(`${token}`));
});

test('allows package specific token to be created', async () => {
  const token = 'abc123';
  global.fetch = jest.fn()
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          authenticated: true,
          login: 'bcoe',
          registryHref: 'http://www.example.com'
        })
      })
    })
    .mockImplementationOnce((_u, post) => {
      const body = JSON.parse(post.body);
      assert.strictEqual(body.type, 'package');
      assert.strictEqual(body.packageName, '@bcoe/foo');
      return Promise.resolve({
        json: () => Promise.resolve({
          message: `created token ${token}`
        }),
        status: 200
      })
    });
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  )
  await screen.findByText(/24 hour temporary token/);
  const packageTokenButton = screen.getByTestId('package');
  const packageNameInput = screen.getByPlaceholderText('@googleapis/leftpad');
  fireEvent.change(packageNameInput, {target: {value: '@bcoe/foo'}});
  fireEvent.click(packageTokenButton);
  // When a token is first created, it will be displayed in DOM within
  // flash message:
  await screen.findByText(new RegExp(`${token}`));
});
