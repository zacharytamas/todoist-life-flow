import { TodoistClient } from 'todoist-rest';
import { Label, Task } from 'todoist-rest/src/models';
import { Not, OR, AND } from 'todoist-rest/src/filters';

interface ILifeFlowOptions {
  token: string;
}

interface IAspect {
  category: string; // TODO reconsider these names
  leaf: string; // TODO reconsider these names
  label?: Label;
}

interface IAspectCategoryMap {
  [key: string]: IAspect[];
}

export class LifeFlow {
  protected options: ILifeFlowOptions;
  protected client: TodoistClient;
  protected aspectMap: IAspectCategoryMap;

  constructor(options: ILifeFlowOptions) {
    this.options = {
      ...options
    };

    this.initializeTodoistClient(options.token);
    this.fetchAspects();
  }

  async listAspects() {
    if (this.aspectMap) {
      return this.aspectMap;
    } else {
      await this.fetchAspects();
      return this.aspectMap;
    }
  }

  /**
   * Returns an array of Tasks which are missing a value for a given
   * Aspect.
   * @param category Aspect category
   */
  async tasksMissingAspect(
    category: string,
    ignoreFuture = false
  ): Promise<Task[]> {
    const aspects = (await this.listAspects())[category];

    if (!aspects) {
      return [];
    }

    // Create filter for Tasks which have none of the Aspect's properties
    // set
    let filter = AND(
      Not('@meta'),
      Not(`@ignore/time`),
      Not(OR(...aspects.map(a => `@${a.category}/${a.leaf}`)))
    );

    if (ignoreFuture) {
      filter = AND(filter, OR('today', 'overdue', 'no date'));
    }

    return (await this.client.tasks.filter({ filter })).filter(
      task => task.indent === 1
    );
  }

  async tasksWithAspect(category: string): Promise<Task[]> {
    const aspects = (await this.listAspects())[category];

    if (!aspects) {
      return [];
    }

    const filter = AND(
      Not('@meta'),
      OR(...aspects.map(a => `@${a.category}/${a.leaf}`))
    );

    return (await this.client.tasks.filter({ filter })).filter(
      task => task.indent === 1
    );
  }

  async getTasksByFilter(filter: string) {
    return this.client.tasks.filter({ filter });
  }

  private initializeTodoistClient(token: string) {
    this.client = new TodoistClient({ token });
  }

  private async fetchAspects() {
    const allLabels = await this.client.labels.all();
    const map: IAspectCategoryMap = {};

    this.aspectMap = allLabels.reduce((mapInProgress, label) => {
      // Skip anything labeled with 'meta'
      if (label.name.startsWith('ignore') || !label.name.includes('/')) {
        return mapInProgress;
      }
      const [category, leaf] = label.name.split(/\//);

      if (!mapInProgress[category]) {
        mapInProgress[category] = [];
      }

      mapInProgress[category].push({ category, label, leaf });

      return mapInProgress;
    }, map);
  }
}
