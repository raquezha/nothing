export type WorkflowName = "norpiv" | "research" | "generic" | string;

export type TaskLike = {
  workflow?: WorkflowName | null;
  id?: string | null;
};

export type Taskish = {
  task?: TaskLike | null;
  workflow?: WorkflowName | null;
  taskId?: string | null;
};

export type RepositoryLike = {
  name?: string | null;
  branch?: string | null;
};

export type Repoish = {
  repository?: RepositoryLike | null;
  repositoryName?: string | null;
  repoName?: string | null;
};

export type StatusLike = {
  status?: string | null;
};

export type EventLike = {
  type?: string | null;
};

export type DateValue = string | number;
export type MaybeNumber = number | null | undefined;
export type MaybeString = string | null | undefined;
