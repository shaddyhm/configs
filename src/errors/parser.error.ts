import { PackageError } from './package.error';

export class ParserError extends PackageError {
  constructor(message: string) {
    super(message);
  }
}
