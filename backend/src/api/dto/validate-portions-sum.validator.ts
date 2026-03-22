import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Custom Validator: ValidatePortionsSum
 *
 * Ensures that the sum of all fee portions (charity, kindswap, rebate, staking)
 * equals 1.0 (100%) with a tolerance of 0.0001 to account for floating point precision.
 *
 * Usage:
 * @ValidatePortionsSum()
 * on the UpdateFeeConfigDto class
 *
 * Validation Logic:
 * - Sums: charityPortion + kindswapPortion + rebatePortion + stakingPortion
 * - Checks: Math.abs(sum - 1.0) < 0.0001
 * - Error: "Fee portions must sum to 1.0. Current sum: {actual_sum}"
 */
@ValidatorConstraint({ name: 'validatePortionsSum', async: false })
export class ValidatePortionsSumConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const object = args.object as any;

    // Extract portion values, defaulting to 0 if not provided
    const charityPortion = object.charityPortion ?? 0;
    const kindswapPortion = object.kindswapPortion ?? 0;
    const rebatePortion = object.rebatePortion ?? 0;
    const stakingPortion = object.stakingPortion ?? 0;

    // Calculate sum
    const sum = charityPortion + kindswapPortion + rebatePortion + stakingPortion;

    // Check if sum equals 1.0 with tolerance for floating point precision
    const tolerance = 0.0001;
    const isValid = Math.abs(sum - 1.0) < tolerance;

    return isValid;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as any;

    // Calculate actual sum for error message
    const charityPortion = object.charityPortion ?? 0;
    const kindswapPortion = object.kindswapPortion ?? 0;
    const rebatePortion = object.rebatePortion ?? 0;
    const stakingPortion = object.stakingPortion ?? 0;
    const sum = charityPortion + kindswapPortion + rebatePortion + stakingPortion;

    return `Fee portions must sum to 1.0. Current sum: ${sum.toFixed(4)} (charity: ${charityPortion}, platform: ${kindswapPortion}, rebate: ${rebatePortion}, staking: ${stakingPortion})`;
  }
}

/**
 * Decorator to validate that fee portions sum to 1.0
 *
 * @param validationOptions Optional validation options
 *
 * @example
 * export class UpdateFeeConfigDto {
 *   @ValidatePortionsSum()
 *   charityPortion?: number;
 * }
 */
export function ValidatePortionsSum(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validatePortionsSum',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: ValidatePortionsSumConstraint,
    });
  };
}
