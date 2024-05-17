import { PackageError } from './package.error';

export class FileError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
