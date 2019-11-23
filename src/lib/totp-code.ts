
import * as crypto from 'crypto';
import * as otplib from 'otplib';

export const totpCode = (secret: string, epoch?: number) => {
  if (epoch) epoch = epoch / 1000;
  const authen = new otplib.authenticator.Authenticator();
  authen.options = {epoch, crypto};
  return authen.generate(secret);
};