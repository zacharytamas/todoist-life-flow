import { LifeFlow } from './flow';
import * as inquirer from 'inquirer';
import { Label, Task } from 'todoist-rest';
import { trySaving } from './task-utils';
import { OR, AND } from 'todoist-rest/src/filters';

interface IOption {
  type: 'slot' | 'action';
  label?: Label;
  action?: 'delete-task' | 'complete-task' | 'skip';
}

class SlotCounter {
  constructor(private taskCounts = {}) {}

  set(label: Label, count: number) {
    this.taskCounts[label.name] = count;
  }

  increment(label: Label) {
    this.taskCounts[label.name] += 1;
  }

  get(label: Label) {
    return this.taskCounts[label.name];
  }
}

const printTaskDigest = (task: Task) => {
  console.log(`Task: ${task.content}`);
  let singleAction = true;

  if (task.due) {
    // TODO if it is overdue, log how many days overdue TODO (maybe) use
    // chalk to make it be in red text if overdue
    console.log(` Due: ${task.due.date}`);
    singleAction = !!!task.due.recurring;
  }

  console.log(`Type: ${singleAction ? 'Single-action' : 'Recurring'}`);
  console.log(`Link: ${task.url}`);
};

(async () => {
  const flow = new LifeFlow({
    token: require('../config.json').token
  });

  const timeSlots = (await flow.listAspects()).time;

  console.log('Calculating current time slot counts...');
  const slotCounter = new SlotCounter();

  await Promise.all(
    timeSlots.map(async slot => {
      const { label } = slot;
      const filterString = AND(
        OR('today', 'overdue', 'no due date'),
        `@${label.name}`
      );

      const tasksInSlot = await flow.getTasksByFilter(filterString);

      slotCounter.set(label, tasksInSlot.length);
    })
  );

  const tasks = await flow.tasksMissingAspect('time', true);

  let current = 1;
  let total = tasks.length;

  const staticMenuOptions = [
    {
      name: `Skip for now`,
      value: { type: 'action', action: 'skip' }
    },
    {
      name: `I've already done this.`,
      // tslint:disable-next-line:no-object-literal-type-assertion
      value: { action: `complete-task`, type: `action` } as IOption
    },
    {
      name: `I've decided not to do this.`,
      value: { action: `delete-task`, type: `action` }
    },
    new inquirer.Separator()
  ];

  for (const task of tasks) {
    // Skip the special task "headings" that Todoist has.
    if (task.content.endsWith(':')) {
      total -= 1;
      continue;
    }

    console.log(`\n(${current} of ${total})`);
    printTaskDigest(task);

    const question = {
      choices: [
        ...staticMenuOptions,
        ...timeSlots.map(a => ({
          name: `${a.leaf} (${slotCounter.get(a.label)})`,
          value: { type: 'slot', label: a.label }
        }))
      ],
      message: `When will you do this?`,
      name: 'response',
      pageSize: 10,
      type: 'list'
    };

    const { response } = (await inquirer.prompt(question)) as any;

    switch ((response as IOption).type) {
      case 'slot':
        task.addLabel(response.label);
        await trySaving(task);
        slotCounter.increment(response.label);
        console.log('Slotted task.');
        break;
      case 'action':
        switch (response.action) {
          case 'delete-task':
            await task.delete();
            console.log('Deleted task.');
            break;
          case 'complete-task':
            await task.complete();
            console.log('Completed task.');
            break;
          default:
            console.log('Skipped task.');
        }
    }

    current += 1;
  }
})();
