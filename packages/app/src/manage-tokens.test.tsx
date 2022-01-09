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

import {render, screen, fireEvent, waitForElementToBeRemoved} from '@testing-library/react'
import React from 'react'
import {MemoryRouter} from 'react-router-dom'

import '@testing-library/jest-dom'

import App from './app'

beforeEach(() => {
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

test('renders manage token page with list of existing tokens', async () => {
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
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({data: [
          {
            created: Date.now(),
            prefix: 'deadbeef'
          }
        ]})
      })
    })
  render(
    <MemoryRouter initialEntries={["/_/manage"]}>
      <App />
    </MemoryRouter>
  )
  await screen.findByText(/deadbeef/);
});

test('allows a token to be deleted', async () => {
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
    .mockImplementationOnce(() => {
      return Promise.resolve({
        json: () => Promise.resolve({data: [
          {
            created: Date.now(),
            prefix: 'deadbeef'
          }
        ]})
      })
    })
  render(
    <MemoryRouter initialEntries={["/_/manage"]}>
      <App />
    </MemoryRouter>
  )

  await screen.findByText(/deadbeef/);
  const delButton = screen.getByText('Delete');
  fireEvent.click(delButton);
  await waitForElementToBeRemoved(delButton);
});
