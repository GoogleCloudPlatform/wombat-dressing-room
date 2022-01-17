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

import * as React from "react";

interface FlashMessageType {
  severity: 'success' | 'info';
  message: string;
  set: (severity: 'success' | 'info', message: string) => {},
  reset: () => {};
}

const FlashMessageContext = React.createContext<FlashMessageType>(null!);
 
export function FlashMessageProvider({ children }: { children: React.ReactNode }) {
  const [severity, setSeverity] =  React.useState<any>(false);
  const [message, setMessage] =  React.useState<any>(null);
 
  const set = (severity: 'success' | 'info', message: string) => {
    setSeverity(severity);
    setMessage(message);
  }

  const reset = () => {
    setMessage(null);
    setSeverity('success');
  };
 
  const value = { severity, message, set, reset };

  return <FlashMessageContext.Provider value={value}>{children}</FlashMessageContext.Provider>;
}

export function useFlashMessage() {
  return React.useContext(FlashMessageContext);
}
