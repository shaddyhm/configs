import { PackageError } from './package.error';

export class ExtensionError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
