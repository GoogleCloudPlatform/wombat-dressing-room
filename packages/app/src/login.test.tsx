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

import {render} from '@testing-library/react'
import React from 'react'
import {MemoryRouter} from 'react-router-dom'

import '@testing-library/jest-dom'

import App from './app'
import {waitForAttribute} from './setupTests.tsx';

beforeEach(() => {
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

test('redirects to login screen if account not authenticated', async () => {
  global.fetch = jest.fn()
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          authenticated: false,
          registryHref: 'http://www.example.com'
        })
      })
    })
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          link: 'http://www.example.com/login'
        })
      })
    });
  render(
    <MemoryRouter initialEntries={["/_/manage"]}>
      <App />
    </MemoryRouter>
  )
  // Wait for initial redirect to login page:
  await waitForAttribute(/Login to Wombat Dressing Room/, 'href', 'http://www.example.com/login');
});
