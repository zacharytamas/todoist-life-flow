/**
 * This is a script which ensures that all Tasks have Aspects assigned to
 * them.
 */

import { LifeFlow } from './flow';
import * as inquirer from 'inquirer';
import { trySaving } from './task-utils';

(async () => {
  const flow = new LifeFlow({
    token: require('../config.json').token
  });

  const aspects = await flow.listAspects();
  const list = Object.entries(aspects);

  for (const [category, aspectList] of list) {
    console.log(`Ensuring ${category}\n`);
    const tasks = await flow.tasksMissingAspect(category);
    let current = 1;
    let total = tasks.length;

    for (const task of tasks) {
      // Skip the special task "headings" that Todoist has.
      if (task.content.endsWith(':')) {
        total -= 1;
        continue;
      }

      console.log(`\n(${current} of ${total}) ${task.content}\n[${task.url}]`);

      const question = {
        choices: aspectList.map(a => ({ name: a.leaf, value: a.label })),
        message: `What ${category} aspects apply here?`,
        name: 'labels',
        type: 'checkbox'
      };

      const { labels } = (await inquirer.prompt(question)) as any;

      if (labels.length > 0) {
        task.addLabels(...labels);
        await trySaving(task);
      }

      current += 1;
    }
  }
})();
