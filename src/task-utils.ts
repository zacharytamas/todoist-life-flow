import { Task } from 'todoist-rest';

/**
 * For some reason API requests return 500s fairly frequently and if you
 * try the same exact request again afterwards it works. This is a hack to
 * keep retrying with an exponential delay until it finally works.
 * @param task Task to save.
 */
export function trySaving(task: Task) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const MAX_TRIES = 6;

    const saver = async () => {
      try {
        await task.save();
        resolve();
      } catch (e) {
        if (tries > MAX_TRIES) {
          reject('Gave up trying to save this Task.');
          return;
        }

        // tslint:disable-next-line:no-magic-numbers
        const next = 2 ** tries;
        console.info(`Couldn't save, trying again in ${next}s.`);
        tries += 1;
        // tslint:disable-next-line:no-magic-numbers
        setTimeout(saver, next * 1000);
      }
    };

    saver();
  });
}
