/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
type Options = {
  readonly concurrency?: number;
  readonly stopOnError?: boolean;
  readonly signal?: AbortSignal;
};

type MaybePromise<T> = T | Promise<T>;

type Mapper<Element = any, NewElement = unknown> = (
  element: Element,
  index: number,
) => MaybePromise<NewElement | typeof pMapSkip>;

const pMapSkip: unique symbol = Symbol('skip');

export async function pMap<Element, NewElement>(
  iterable:
    | AsyncIterable<Element | Promise<Element>>
    | Iterable<Element | Promise<Element>>,
  mapper: Mapper<Element, NewElement>,
  options?: Options,
) {
  const {
    concurrency = Number.POSITIVE_INFINITY,
    signal,
    stopOnError = true,
  } = options ?? {};

  return new Promise((resolve_, reject_) => {
    if (
      // @ts-ignore
      iterable[Symbol.iterator] === undefined &&
      // @ts-ignore
      iterable[Symbol.asyncIterator] === undefined
    ) {
      throw new TypeError(
        `Expected \`input\` to be either an \`Iterable\` or \`AsyncIterable\`, got (${typeof iterable})`,
      );
    }

    if (typeof mapper !== 'function') {
      throw new TypeError('Mapper function is required');
    }

    if (
      !(
        (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
        concurrency === Number.POSITIVE_INFINITY
      )
    ) {
      throw new TypeError(
        `Expected \`concurrency\` to be an integer from 1 and up or \`Infinity\`, got \`${concurrency}\` (${typeof concurrency})`,
      );
    }

    const result: any = [];
    const errors: any = [];
    const skippedIndexesMap = new Map();
    let isRejected = false;
    let isResolved = false;
    let isIterableDone = false;
    let resolvingCount = 0;
    let currentIndex = 0;
    const iterator =
      // @ts-ignore
      iterable[Symbol.iterator] === undefined
        ? // @ts-ignore
          iterable[Symbol.asyncIterator]()
        : // @ts-ignore
          iterable[Symbol.iterator]();

    const signalListener = () => {
      // @ts-ignore
      reject(signal.reason);
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', signalListener);
    };

    const resolve = (value: any) => {
      resolve_(value);
      cleanup();
    };

    const reject = (reason: any) => {
      isRejected = true;
      isResolved = true;
      reject_(reason);
      cleanup();
    };

    if (signal) {
      if (signal.aborted) {
        reject(signal.reason);
      }

      signal.addEventListener('abort', signalListener, { once: true });
    }

    const next = async () => {
      if (isResolved) {
        return;
      }

      const nextItem = await iterator.next();

      const index = currentIndex;
      currentIndex++;

      // Note: `iterator.next()` can be called many times in parallel.
      // This can cause multiple calls to this `next()` function to
      // receive a `nextItem` with `done === true`.
      // The shutdown logic that rejects/resolves must be protected
      // so it runs only one time as the `skippedIndex` logic is
      // non-idempotent.
      if (nextItem.done) {
        isIterableDone = true;

        if (resolvingCount === 0 && !isResolved) {
          if (!stopOnError && errors.length > 0) {
            reject(new AggregateError(errors));
          }

          isResolved = true;

          if (skippedIndexesMap.size === 0) {
            resolve(result);
            return;
          }

          const pureResult = [];

          // Support multiple `pMapSkip`'s.
          for (const [index, value] of result.entries()) {
            if (skippedIndexesMap.get(index) === pMapSkip) {
              continue;
            }
            //@ts-ignore
            pureResult.push(value);
          }

          resolve(pureResult);
        }

        return;
      }

      resolvingCount++;

      // Intentionally detached
      (async () => {
        try {
          const element = await nextItem.value;

          if (isResolved) {
            return;
          }

          const value = await mapper(element, index);

          // Use Map to stage the index of the element.
          if (value === pMapSkip) {
            skippedIndexesMap.set(index, value);
          }

          result[index] = value;

          resolvingCount--;
          await next();
        } catch (error) {
          if (stopOnError) {
            reject(error);
          } else {
            errors.push(error);
            resolvingCount--;

            // In that case we can't really continue regardless of `stopOnError` state
            // since an iterable is likely to continue throwing after it throws once.
            // If we continue calling `next()` indefinitely we will likely end up
            // in an infinite loop of failed iteration.
            try {
              await next();
            } catch (error) {
              reject(error);
            }
          }
        }
      })();
    };

    // Create the concurrent runners in a detached (non-awaited)
    // promise. We need this so we can await the `next()` calls
    // to stop creating runners before hitting the concurrency limit
    // if the iterable has already been marked as done.
    // NOTE: We *must* do this for async iterators otherwise we'll spin up
    // infinite `next()` calls by default and never start the event loop.
    (async () => {
      for (let index = 0; index < concurrency; index++) {
        try {
          await next();
        } catch (error) {
          reject(error);
          break;
        }

        if (isIterableDone || isRejected) {
          break;
        }
      }
    })();
  });
}
