import { PackageError } from './package.error';

export class FilesError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
