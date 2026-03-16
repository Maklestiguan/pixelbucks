import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { getCompiled } from '../../validations';

@Injectable()
export class FastestValidatorPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' || !metadata.metatype) {
      return value;
    }

    // Skip validation for primitive types
    const primitives = [String, Boolean, Number, Array, Object];
    if (primitives.includes(metadata.metatype as any)) {
      return value;
    }

    let check: ReturnType<typeof getCompiled>;
    try {
      check = getCompiled(metadata.metatype);
    } catch {
      // No schema compiled for this type — skip validation
      return value;
    }

    const result = check(value);

    if (result !== true) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result,
      });
    }

    return value;
  }
}
