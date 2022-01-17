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
import '@testing-library/jest-dom'
import {waitForAttribute} from './setupTests.tsx';

import React from 'react'
import {MemoryRouter} from 'react-router-dom'
import App from './app'

beforeEach(() => {
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

test('clicking logout redirects to login screen', async () => {
  global.fetch = jest.fn()
    // Fetch account.
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          authenticated: true,
          login: 'bcoe',
          registryHref: 'http://www.example.com'
        })
      })
    })
    // Logout.
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          link: 'http://www.example.com/login'
        })
      })
    })
    // Fetch login link.
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({
          link: 'http://www.example.com/login2'
        })
      })
    });
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  )
  // Wait for protected page to render:
  await screen.findByText(/24 hour temporary token/);
  const logoutButton = screen.getByText('Logout');
  fireEvent.click(logoutButton);
  await waitForAttribute(/Login to Wombat Dressing Room/, 'href', 'http://www.example.com/login2');
});
