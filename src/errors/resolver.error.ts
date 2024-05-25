import { PackageError } from './package.error';

export class ResolverError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
