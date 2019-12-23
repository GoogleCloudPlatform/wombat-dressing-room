export class WombatServerError extends Error {
  statusCode: number;
  statusMessage: string;
  constructor(msg: string, statusCode = 500) {
    super(msg);
    this.statusCode = statusCode;
    this.statusMessage = msg;
  }
}
