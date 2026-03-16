export class CqrsValidationError extends Error {
  public readonly errors: any[];

  constructor(errors: any[]) {
    super('Validation failed');
    this.name = 'CqrsValidationError';
    this.errors = errors;
  }
}
