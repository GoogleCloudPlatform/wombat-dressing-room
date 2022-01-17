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

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import {screen} from '@testing-library/react'

async function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

export async function waitForAttribute(text: RegExp, attribute: string, expected: string, count = 0) {
  if (count > 10) throw Error(`${attribute} never equals ${expected}`);
  const element = await screen.findByText(text);
  if (element.getAttribute(attribute) === expected) return true;
  await wait(10);
  await waitForAttribute(text, attribute, expected, count + 1);
}
