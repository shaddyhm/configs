import { PackageError } from './package.error';

export class DirectoryError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
