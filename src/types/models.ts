export type UserRole = 'admin' | 'cleaner' | 'annotator' | 'trainer'
export type ModelIterationStatus = 'active' | 'archived'
export type DatasetStage = 'raw' | 'cleaned' | 'annotated'
export type TaskStatus =
  | 'pending_clean'
  | 'pending_annotate'
  | 'pending_train'
  | 'finished'
export type TaskReviewStatus = 'none' | 'pending_admin_review' | 'rejected'
export type TaskReviewStage = 'clean' | 'annotate' | 'train'

export type UploadPurpose =
  | 'task_source'
  | 'task_cleaned'
  | 'task_annotated'
  | 'task_model'

export type AuthUser = {
  id: number
  username: string
  role: UserRole
  createdAt: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type UserSummary = {
  id: number
  username: string
  role: UserRole
  createdAt: string
}

export type PaginationMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type DatasetVersionSummary = {
  id: number
  versionNo: number
  stage: DatasetStage
  stageLabel: string
  label: string
  parentVersionId: number | null
  parentVersionLabel: string | null
  reviewBased: boolean
  createdBy: TaskAssignee
  createdAt: string
  fileName: string
  sourceTaskId: number
}

export type DatasetSummary = {
  id: number
  taskId: number
  name: string
  description: string
  modality: string
  taskType: string
  creator: TaskAssignee
  currentVersionId: number | null
  currentVersionLabel: string | null
  currentVersionNo: number | null
  versionCount: number
  createdAt: string
  updatedAt: string
}

export type DatasetDetail = DatasetSummary & {
  taskTitle: string
  versions: DatasetVersionSummary[]
}

export type DatasetListResponse = {
  items: DatasetSummary[]
  pagination: PaginationMeta
}

export type UserListSummary = {
  total: number
  adminCount: number
  workerCount: number
}

export type UserListResponse = {
  items: UserSummary[]
  pagination: PaginationMeta
  summary: UserListSummary
}

export type TaskAssignee = {
  id: number
  username: string
}

export type ModelIterationRef = {
  id: number
  name: string
  status: ModelIterationStatus
}

export type ModelIterationSummary = {
  id: number
  name: string
  description: string
  baseModelName: string
  goal: string
  status: ModelIterationStatus
  statusLabel: string
  creatorId: number
  creatorUsername: string
  currentBestTaskId: number | null
  latestTaskId: number | null
  createdAt: string
  updatedAt: string
  taskCount: number
  latestTaskAt: string | null
}

export type ModelIterationTaskItem = {
  id: number
  title: string
  status: TaskStatus
  statusLabel: string
  reviewStatus: TaskReviewStatus
  reviewStatusLabel: string
  cleaner: TaskAssignee
  annotator: TaskAssignee
  trainer: TaskAssignee
  createdAt: string
  finishedAt: string | null
}

export type ModelIterationResultItem = {
  taskId: number
  taskTitle: string
  modelFileName: string
  trainerRemark: string | null
  finishedAt: string
  trainer: TaskAssignee
  download: {
    alias: 'model'
    label: string
    fileName: string
    endpoint: string
  }
}

export type ModelIterationDetail = {
  id: number
  name: string
  description: string
  baseModelName: string
  goal: string
  status: ModelIterationStatus
  statusLabel: string
  creator: TaskAssignee
  currentBestTaskId: number | null
  latestTaskId: number | null
  createdAt: string
  updatedAt: string
  tasks: ModelIterationTaskItem[]
  results: ModelIterationResultItem[]
  latestModelResult: ModelIterationResultItem | null
  currentBestResult: ModelIterationResultItem | null
}

export type ModelIterationListResponse = {
  items: ModelIterationSummary[]
  pagination: PaginationMeta
}

export type TaskSummary = {
  id: number
  modelIteration: ModelIterationRef
  dataset: {
    id: number
    name: string
    rawVersionId: number | null
    cleanedVersionId: number | null
    annotatedVersionId: number | null
  } | null
  title: string
  description: string
  status: TaskStatus
  statusLabel: string
  needCleanReview: boolean
  needAnnotateReview: boolean
  needTrainReview: boolean
  approvalStages: TaskReviewStage[]
  currentStageNeedsReview: boolean
  reviewStatus: TaskReviewStatus
  reviewStatusLabel: string
  reviewStage: TaskReviewStage | null
  reviewStageLabel: string | null
  reviewActionLabel: string | null
  reviewComment: string | null
  needsAdminReview: boolean
  createdAt: string
  finishedAt: string | null
  creator: TaskAssignee
  assignees: {
    cleaner: TaskAssignee
    annotator: TaskAssignee
    trainer: TaskAssignee
  }
  myRole: UserRole
  canHandle: boolean
  canReview: boolean
  canResubmit: boolean
}

export type TaskListSummary = {
  total: number
  actionableCount: number
  finishedCount: number
}

export type TaskListResponse = {
  items: TaskSummary[]
  pagination: PaginationMeta
  summary: TaskListSummary
}

export type TaskDownload = {
  alias: 'source' | 'cleaned' | 'annotated' | 'model'
  label: string
  fileName: string
  endpoint: string
  canPreview: boolean
  previewEndpoint: string | null
}

export type TaskDownloadLink = {
  url: string
  expiresAt: string
}

export type TaskDetail = TaskSummary & {
  remarks: {
    cleaner: string | null
    annotator: string | null
    trainer: string | null
  }
  downloads: TaskDownload[]
  canSubmitCurrentStage: boolean
  canReviewCurrentStage: boolean
  canResubmitCurrentStage: boolean
  currentStage: {
    role: UserRole | null
    label: string
  }
  dataset: {
    id: number
    name: string
    currentVersion: {
      id: number
      versionNo: number
      stage: DatasetStage
      stageLabel: string
      label: string
    } | null
    versions: DatasetVersionSummary[]
    keyVersions: {
      raw: {
        id: number
        label: string
        stage: DatasetStage
        stageLabel: string
        createdAt: string
      } | null
      cleaned: {
        id: number
        label: string
        stage: DatasetStage
        stageLabel: string
        createdAt: string
      } | null
      annotated: {
        id: number
        label: string
        stage: DatasetStage
        stageLabel: string
        createdAt: string
      } | null
    }
  } | null
}

export type ModelListItem = {
  taskId: number
  taskTitle: string
  modelFileName: string
  trainerRemark: string | null
  finishedAt: string
  modelIteration: ModelIterationRef
  trainer: {
    id: number
    username: string
  }
  download: {
    alias: 'model'
    label: string
    fileName: string
    endpoint: string
  }
}

export type ModelListResponse = {
  items: ModelListItem[]
  pagination: PaginationMeta
}

export type UploadedFileRef = {
  storageKey: string
  originalName: string
  mimeType: string
  size: number
}

export type TaskArchivePreviewItem = {
  id: string
  name: string
  mimeType: string
  size: number
  endpoint: string
}

export type TaskArchivePreviewPage = {
  items: TaskArchivePreviewItem[]
  pagination: PaginationMeta
}
