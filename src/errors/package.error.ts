export abstract class PackageError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
    this.name = this.constructor.name;
  }
}
